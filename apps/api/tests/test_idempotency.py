import pytest
from unittest.mock import ANY
import redis

def test_spam_approve_clicks_idempotency(client, auth_tokens, monkeypatch, db_session_factory):
    student_id = "930-26-1001" # use an existing valid ID format
    monkeypatch.setattr("app.core.enrollment_db.assert_approval_hygiene", lambda *args, **kwargs: None)
    
    # 1. First, create a pending enrollment
    from app.db.models import Student, Enrollment
    with db_session_factory() as db:
        student = Student(student_id=student_id, full_name="Test", phone="123", university_email="test@diu.edu.bd")
        db.add(student)
        enrollment = Enrollment(
            student_id=student_id,
            status="validated",
            verification_completed=True,
            total_required_shots=10,
            total_accepted_shots=10,
            validation_passed=True
        )
        db.add(enrollment)
        db.commit()

    delay_called_count = 0
    def mock_delay(*args, **kwargs):
        nonlocal delay_called_count
        delay_called_count += 1
        
    import app.api.routes.admin as admin_routes
    monkeypatch.setattr(admin_routes.process_student_enrollment_task, "delay", mock_delay)
    
    # First approve
    response1 = client.post(
        f"/admin/enrollments/{student_id}/approve",
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert response1.status_code == 200
    assert response1.json().get("success") is True
    assert response1.json().get("processing_attempted") is True
    assert delay_called_count == 1
    
    # Second approve (spam)
    response2 = client.post(
        f"/admin/enrollments/{student_id}/approve",
        headers={"Authorization": f"Bearer {auth_tokens['admin']}"},
    )
    assert response2.status_code == 200
    assert response2.json().get("success") is True
    assert response2.json().get("processing_attempted") is False # because it wasn't updated
    assert delay_called_count == 1 # still 1!


def test_worker_lock_idempotency(monkeypatch):
    import app.tasks.biometric_tasks as tasks
    student_id = "930-26-locktest"
    
    class DummyRequest:
        id = "task-123"
        
    class DummyTask:
        request = DummyRequest()
        
    # Mock redis lock
    lock_acquire_calls = 0
    lock_release_calls = 0
    
    class DummyLock:
        def __init__(self, key, timeout):
            pass
            
        def acquire(self, blocking=False):
            nonlocal lock_acquire_calls
            lock_acquire_calls += 1
            return lock_acquire_calls == 1 # Only succeed the first time

        def release(self):
            nonlocal lock_release_calls
            lock_release_calls += 1
            
    class DummyRedis:
        def lock(self, key, timeout):
            return DummyLock(key, timeout)

    monkeypatch.setattr(tasks, "redis_client", DummyRedis())
    
    # Call task first time - should process
    # But we want to mock the DB / pipeline so it doesn't actually run full face processing
    def mock_assert(*args, **kwargs):
        pass
    def mock_mark(*args, **kwargs):
        pass
    def mock_process(*args, **kwargs):
        return {"processed_images_count": 1, "embeddings_generated_count": 1, "processing_passed": True, "processed_crops": []}
    def mock_persist(*args, **kwargs):
        return {"inserted_count": 1, "deactivated_count": 0}
    def mock_record(*args, **kwargs):
        pass
        
    monkeypatch.setattr(tasks, "assert_enrollment_processable", mock_assert)
    monkeypatch.setattr(tasks, "mark_enrollment_as_processing", mock_mark)
    monkeypatch.setattr(tasks, "process_student_images", mock_process)
    monkeypatch.setattr(tasks, "persist_face_embeddings", mock_persist)
    monkeypatch.setattr(tasks, "record_processing_completed_in_db", mock_record)
    
    # Celery bound tasks can be called by omitting 'self' if using the wrapper
    # But to mock self.request.id, we should mock the request context
    from celery.app.task import Context
    tasks.process_student_enrollment_task.request.id = "task-123"
    
    result1 = tasks.process_student_enrollment_task(student_id)
    assert result1.get("success") is True
    assert lock_acquire_calls == 1
    assert lock_release_calls == 1
    
    # Call task second time concurrently (lock acquire will fail)
    result2 = tasks.process_student_enrollment_task(student_id)
    assert result2.get("success") is False
    assert result2.get("error") == "Task is already processing"
    assert lock_acquire_calls == 2
    assert lock_release_calls == 1 # Second one shouldn't release!
    
def test_db_mark_processing_idempotency(db_session_factory):
    student_id = "930-26-dbtest"
    from app.db.models import Student, Enrollment
    from app.core.enrollment_db import mark_enrollment_as_processing
    with db_session_factory() as db:
        student = Student(student_id=student_id, full_name="Test", phone="123", university_email="test@diu.edu.bd")
        db.add(student)
        enrollment = Enrollment(
            student_id=student_id,
            status="approved_pending_processing",
            verification_completed=True,
            total_required_shots=10,
            total_accepted_shots=10,
            validation_passed=True
        )
        db.add(enrollment)
        db.commit()
        
    # Mark it
    mark_enrollment_as_processing(student_id)
    
    with db_session_factory() as db:
        enrollment = db.query(Enrollment).filter(Enrollment.student_id == student_id).first()
        assert enrollment.status == "processing"
        
    # Mark it again - shouldn't fail, just be a no-op
    mark_enrollment_as_processing(student_id)
    
    with db_session_factory() as db:
        enrollment = db.query(Enrollment).filter(Enrollment.student_id == student_id).first()
        assert enrollment.status == "processing"
