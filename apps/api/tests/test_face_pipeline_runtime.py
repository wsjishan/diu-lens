from __future__ import annotations

from pathlib import Path

import app.core.face_pipeline as face_pipeline


def test_antelopev2_nested_candidate_is_used_for_fresh_cache(
    monkeypatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setattr(face_pipeline, "_INSIGHTFACE_MODEL_PACK", "antelopev2")
    monkeypatch.setattr(face_pipeline, "_INSIGHTFACE_ROOT", str(tmp_path))

    assert face_pipeline._resolve_model_name_candidates() == [
        "antelopev2",
        "antelopev2/antelopev2",
    ]
