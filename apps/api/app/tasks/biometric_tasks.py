import logging
import redis
from celery import shared_task

from app.core.config import settings
from app.core.celery_app import celery_app
from app.core.enrollment_db import (
    EnrollmentNotFoundError,
    EnrollmentInvalidStateError,
    EnrollmentPersistenceError,
    assert_enrollment_processable,
    mark_enrollment_as_processing,
    record_processing_completed_in_db,
)
from app.core.face_pipeline import FacePipelineError, process_student_images
from app.core.embeddings_db import FaceEmbeddingPersistenceError, persist_face_embeddings
from app.core.storage import get_storage_service

logger = logging.getLogger(__name__)

redis_client = redis.from_url(settings.redis_url)

@celery_app.task(
    bind=True,
    autoretry_for=(FacePipelineError, EnrollmentPersistenceError, FaceEmbeddingPersistenceError),
    retry_backoff=True,
    retry_backoff_max=120,
    max_retries=3,
)
def process_student_enrollment_task(self, student_id: str) -> dict:
    """Background task to extract and persist biometric embeddings for a student."""
    logger.info("[celery-processing] start student_id=%s task_id=%s", student_id, self.request.id)
    
    lock_key = f"lock:biometric_process:{student_id}"
    lock = redis_client.lock(lock_key, timeout=600)
    
    if not lock.acquire(blocking=False):
        logger.warning("[celery-processing] skipped duplicate task student_id=%s task_id=%s", student_id, self.request.id)
        return {"success": False, "error": "Task is already processing"}
        
    logger.info("[celery-processing] lock acquired student_id=%s task_id=%s", student_id, self.request.id)
        
    try:
        try:
            assert_enrollment_processable(student_id)
            mark_enrollment_as_processing(student_id)
        except EnrollmentNotFoundError as exc:
            logger.error("[celery-processing] error student_id=%s reason=%s", student_id, exc)
            return {"success": False, "error": str(exc)}
        except EnrollmentInvalidStateError as exc:
            logger.error("[celery-processing] invalid state student_id=%s reason=%s", student_id, exc)
            return {"success": False, "error": str(exc)}
        except EnrollmentPersistenceError as exc:
            # Will be caught by autoretry
            raise

        try:
            storage = get_storage_service()
            result = process_student_images(student_id, storage=storage)
            processed_images_count = int(result.get("processed_images_count", 0))
            embeddings_generated_count = int(result.get("embeddings_generated_count", 0))
            processing_passed = bool(result.get("processing_passed", False))

            if processing_passed and embeddings_generated_count > 0:
                persisted = persist_face_embeddings(
                    student_id=student_id,
                    processed_crops=list(result.get("processed_crops", [])),
                )
                logger.info(
                    "[celery-processing] embeddings_saved student_id=%s inserted=%s deactivated=%s",
                    student_id,
                    int(persisted.get("inserted_count", 0)),
                    int(persisted.get("deactivated_count", 0)),
                )
            elif processing_passed and embeddings_generated_count <= 0:
                processing_passed = False

            record_processing_completed_in_db(
                student_id,
                processed_images_count=processed_images_count,
                processing_passed=processing_passed,
            )

            return {
                "success": processing_passed,
                "processed_images_count": processed_images_count,
                "embeddings_generated_count": embeddings_generated_count,
            }
        except Exception as exc:
            logger.exception("[celery-processing] unhandled error student_id=%s", student_id)
            record_processing_completed_in_db(
                student_id,
                processed_images_count=0,
                processing_passed=False,
            )
            raise
    finally:
        try:
            lock.release()
        except redis.exceptions.LockError:
            pass
