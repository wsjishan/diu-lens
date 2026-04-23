from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import cv2
import numpy as np

import app.core.image_validation as image_validation


class _FakeCascade:
    def __init__(self, faces: Sequence[Sequence[int]], *, empty: bool = False) -> None:
        self._faces = list(faces)
        self._empty = empty

    def empty(self) -> bool:
        return self._empty

    def detectMultiScale(self, *_args: Any, **_kwargs: Any) -> list[tuple[int, int, int, int]]:
        return [tuple(int(v) for v in face) for face in self._faces]


def _make_jpeg_bytes(width: int = 640, height: int = 480) -> bytes:
    image = np.full((height, width, 3), 127, dtype=np.uint8)
    ok, encoded = cv2.imencode(".jpg", image)
    assert ok
    return encoded.tobytes()


def test_non_front_face_not_detected_is_non_blocking(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(image_validation, "_FACE_CASCADE", _FakeCascade([]))

    report = image_validation.validate_uploaded_image_sanity(
        image_bytes=_make_jpeg_bytes(),
        file_name="left_1.jpg",
        angle="left",
    )

    assert report["passed"] is True
    assert report["is_blocking_failure"] is False
    assert report["failure_reasons"] == []
    assert "face_not_detected" in report["non_blocking_reasons"]
    assert report["final_decision"] == "accept"


def test_front_face_not_detected_remains_blocking(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(image_validation, "_FACE_CASCADE", _FakeCascade([]))

    report = image_validation.validate_uploaded_image_sanity(
        image_bytes=_make_jpeg_bytes(),
        file_name="front_1.jpg",
        angle="front",
    )

    assert report["passed"] is False
    assert report["is_blocking_failure"] is True
    assert "face_not_detected" in report["failure_reasons"]
    assert report["final_decision"] == "reject"


def test_multiple_faces_confidently_detected_is_blocking_for_non_front(
    monkeypatch: Any,
) -> None:
    # Large second face (>35% area of largest) should be treated as confident multiple-face.
    monkeypatch.setattr(
        image_validation,
        "_FACE_CASCADE",
        _FakeCascade(
            [
                (10, 20, 100, 100),
                (220, 25, 90, 90),
            ]
        ),
    )

    report = image_validation.validate_uploaded_image_sanity(
        image_bytes=_make_jpeg_bytes(),
        file_name="down_1.jpg",
        angle="down",
    )

    assert report["passed"] is False
    assert report["is_blocking_failure"] is True
    assert any(
        reason.startswith("multiple_faces_detected") for reason in report["failure_reasons"]
    )
    assert report["final_decision"] == "reject"
