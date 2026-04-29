import logging
from dataclasses import dataclass
from typing import Any, Literal

import cv2
import numpy as np


EyesVisibleStatus = Literal["passed", "failed", "not_yet_implemented"]


@dataclass(frozen=True)
class ImageValidationConfig:
    min_blur_variance: float = 45.0
    min_brightness: float = 70.0
    max_brightness: float = 200.0
    min_width: int = 224
    min_height: int = 224
    min_face_size: int = 40
    max_center_offset_front: float = 0.28
    max_center_offset_non_front: float = 0.28
    min_face_area_ratio: float = 0.09


_CONFIG = ImageValidationConfig()
_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
logger = logging.getLogger(__name__)
_STRICT_FACE_DETECTION_ANGLES: set[str] = {"front"}


def _default_report(file_name: str, angle: str) -> dict[str, Any]:
    return {
        "file_name": file_name,
        "angle": angle,
        "image_size_bytes": 0,
        "readable": False,
        "decoded_shape": None,
        "dimensions": None,
        "passed": False,
        "blur_ok": False,
        "brightness_ok": False,
        "dimensions_ok": False,
        "face_detected": False,
        "face_centered": False,
        "multiple_faces_detected": False,
        "face_count": 0,
        "center_offset": None,
        "max_center_offset": None,
        "face_size_ratio": None,
        "blocker": "unknown",
        "eyes_visible": "not_yet_implemented",
        "failure_reasons": [],
        "blocking_reasons": [],
        "non_blocking_reasons": [],
        "is_blocking_failure": False,
        "final_decision": "reject",
    }


def _append_reason(
    report: dict[str, Any],
    *,
    reason: str,
    blocking: bool,
) -> None:
    target_key = "blocking_reasons" if blocking else "non_blocking_reasons"
    target_reasons = report.get(target_key)
    if not isinstance(target_reasons, list):
        target_reasons = []
    target_reasons.append(reason)
    report[target_key] = target_reasons


def _dimensions_from_shape(decoded_shape: object) -> str:
    if not isinstance(decoded_shape, list) or len(decoded_shape) < 2:
        return "unknown"
    try:
        height = int(decoded_shape[0])
        width = int(decoded_shape[1])
    except (TypeError, ValueError):
        return "unknown"
    return f"{width}x{height}"


def _finalize_guided_sanity_report(report: dict[str, Any]) -> dict[str, Any]:
    blocking_reasons_raw = report.get("blocking_reasons", [])
    non_blocking_reasons_raw = report.get("non_blocking_reasons", [])
    blocking_reasons = (
        [str(reason) for reason in blocking_reasons_raw]
        if isinstance(blocking_reasons_raw, list)
        else []
    )
    non_blocking_reasons = (
        [str(reason) for reason in non_blocking_reasons_raw]
        if isinstance(non_blocking_reasons_raw, list)
        else []
    )
    has_blocking_failure = len(blocking_reasons) > 0

    report["blocking_reasons"] = blocking_reasons
    report["non_blocking_reasons"] = non_blocking_reasons
    # Keep backward compatibility for API consumers already reading failure_reasons.
    report["failure_reasons"] = blocking_reasons
    report["is_blocking_failure"] = has_blocking_failure
    report["passed"] = not has_blocking_failure
    report["final_decision"] = "reject" if has_blocking_failure else "accept"

    if has_blocking_failure:
        report["blocker"] = _reason_code(blocking_reasons[0])
    elif non_blocking_reasons:
        report["blocker"] = _reason_code(non_blocking_reasons[0])
    else:
        report["blocker"] = "ready"

    log_fn = logger.warning if has_blocking_failure else logger.info
    log_fn(
        "[guided-sanity] angle=%s file=%s readable=%s dimensions=%s face_detected=%s blocking=%s "
        "blocking_reasons=%s non_blocking_reasons=%s final_decision=%s",
        report.get("angle", "unknown"),
        report.get("file_name", "unknown"),
        bool(report.get("readable", False)),
        report.get("dimensions", _dimensions_from_shape(report.get("decoded_shape"))),
        bool(report.get("face_detected", False)),
        has_blocking_failure,
        blocking_reasons,
        non_blocking_reasons,
        report.get("final_decision", "reject"),
    )
    return report


def _max_center_offset_for_angle(config: ImageValidationConfig, angle: str) -> float:
    return (
        config.max_center_offset_front
        if angle == "front"
        else config.max_center_offset_non_front
    )


def _reason_code(reason: str) -> str:
    return reason.split("(", 1)[0].strip()


def extract_image_quality_metadata(
    image_bytes: bytes,
    *,
    config: ImageValidationConfig = _CONFIG,
) -> dict[str, float | None]:
    metadata: dict[str, float | None] = {
        "blur_score": None,
        "brightness": None,
        "face_area_ratio": None,
        "center_offset": None,
        "detection_confidence": None,
    }
    if not image_bytes:
        return metadata

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        return metadata

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    metadata["blur_score"] = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    metadata["brightness"] = float(gray.mean())

    if _FACE_CASCADE.empty():
        return metadata

    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(config.min_face_size, config.min_face_size),
    )
    if len(faces) <= 0:
        metadata["detection_confidence"] = 0.0
        return metadata

    metadata["detection_confidence"] = 1.0
    height, width = image.shape[:2]
    largest_face = max(faces, key=lambda f: int(f[2]) * int(f[3]))
    x, y, w, h = [int(v) for v in largest_face]

    if height > 0 and width > 0:
        metadata["face_area_ratio"] = (float(w) * float(h)) / float(width * height)
        face_center_x = x + (w / 2.0)
        face_center_y = y + (h / 2.0)
        face_center_norm_x = face_center_x / float(width)
        face_center_norm_y = face_center_y / float(height)
        metadata["center_offset"] = float(
            np.hypot(face_center_norm_x - 0.5, face_center_norm_y - 0.5)
        )

    return metadata


def validate_uploaded_image_integrity(
    image_bytes: bytes,
    file_name: str,
    angle: str,
    config: ImageValidationConfig = _CONFIG,
) -> dict[str, Any]:
    report = _default_report(file_name=file_name, angle=angle)
    failure_reasons: list[str] = []

    if not image_bytes:
        failure_reasons.append("missing_image_data")
        report["failure_reasons"] = failure_reasons
        report["blocker"] = _reason_code(failure_reasons[0])
        return report

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        failure_reasons.append("invalid_image_data")
        report["failure_reasons"] = failure_reasons
        report["blocker"] = _reason_code(failure_reasons[0])
        return report

    height, width = image.shape[:2]
    dimensions_ok = width >= config.min_width and height >= config.min_height
    report["dimensions_ok"] = dimensions_ok
    if not dimensions_ok:
        failure_reasons.append(
            f"image_too_small(min:{config.min_width}x{config.min_height},got:{width}x{height})"
        )

    # Final-stage gate is intentionally lightweight: we only verify integrity/presence.
    # Quality constraints (lighting/face/angle/blur/centering) are enforced during live capture.
    report["blur_ok"] = True
    report["brightness_ok"] = True
    report["face_detected"] = True
    report["face_centered"] = True

    report["passed"] = len(failure_reasons) == 0
    report["failure_reasons"] = failure_reasons
    report["blocker"] = _reason_code(failure_reasons[0]) if failure_reasons else "ready"
    return report


def validate_uploaded_image_sanity(
    image_bytes: bytes,
    file_name: str,
    angle: str,
    config: ImageValidationConfig = _CONFIG,
) -> dict[str, Any]:
    report = _default_report(file_name=file_name, angle=angle)
    report["image_size_bytes"] = len(image_bytes)
    strict_face_detection = angle in _STRICT_FACE_DETECTION_ANGLES

    if not image_bytes:
        _append_reason(report, reason="missing_image_data", blocking=True)
        return _finalize_guided_sanity_report(report)

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        _append_reason(report, reason="invalid_image_data", blocking=True)
        return _finalize_guided_sanity_report(report)

    report["readable"] = True
    report["decoded_shape"] = [int(v) for v in image.shape]

    height, width = image.shape[:2]
    report["dimensions"] = f"{width}x{height}"
    dimensions_ok = width >= config.min_width and height >= config.min_height
    report["dimensions_ok"] = dimensions_ok
    if not dimensions_ok:
        _append_reason(
            report,
            reason=(
                f"image_too_small(min:{config.min_width}x{config.min_height},got:{width}x{height})"
            ),
            blocking=True,
        )

    # Sanity validator keeps backend at the same or looser strictness than live capture.
    # Blur/brightness/centering/pose are enforced in live capture only.
    report["blur_ok"] = True
    report["brightness_ok"] = True
    report["face_centered"] = True

    if _FACE_CASCADE.empty():
        _append_reason(
            report,
            reason="face_detector_unavailable",
            blocking=strict_face_detection,
        )
        return _finalize_guided_sanity_report(report)

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(config.min_face_size, config.min_face_size),
    )

    face_count = len(faces)
    report["face_count"] = face_count
    report["face_detected"] = face_count > 0
    if face_count == 0:
        _append_reason(
            report,
            reason="face_not_detected",
            blocking=strict_face_detection,
        )
    elif face_count > 1:
        face_areas = sorted(
            [int(w) * int(h) for (_, _, w, h) in faces], reverse=True
        )
        largest_area = face_areas[0] if face_areas else 0
        second_largest_area = face_areas[1] if len(face_areas) > 1 else 0
        has_clear_second_face = (
            largest_area > 0 and second_largest_area >= int(largest_area * 0.35)
        )
        if has_clear_second_face:
            report["multiple_faces_detected"] = True
            _append_reason(
                report,
                reason=f"multiple_faces_detected(count:{face_count})",
                blocking=True,
            )

    return _finalize_guided_sanity_report(report)


def validate_uploaded_image(
    image_bytes: bytes,
    file_name: str,
    angle: str,
    config: ImageValidationConfig = _CONFIG,
) -> dict[str, Any]:
    report = _default_report(file_name=file_name, angle=angle)
    failure_reasons: list[str] = []

    image_array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        failure_reasons.append("invalid_image_data")
        report["failure_reasons"] = failure_reasons
        return report

    height, width = image.shape[:2]
    dimensions_ok = width >= config.min_width and height >= config.min_height
    report["dimensions_ok"] = dimensions_ok
    if not dimensions_ok:
        failure_reasons.append(
            f"image_too_small(min:{config.min_width}x{config.min_height},got:{width}x{height})"
        )

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    blur_variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    blur_ok = blur_variance >= config.min_blur_variance
    report["blur_ok"] = blur_ok
    if not blur_ok:
        failure_reasons.append(
            f"image_blurry(score:{blur_variance:.2f},min:{config.min_blur_variance:.2f})"
        )

    brightness = float(gray.mean())
    brightness_ok = config.min_brightness <= brightness <= config.max_brightness
    report["brightness_ok"] = brightness_ok
    if not brightness_ok:
        failure_reasons.append(
            f"invalid_brightness(value:{brightness:.2f},range:{config.min_brightness:.2f}-{config.max_brightness:.2f})"
        )

    if _FACE_CASCADE.empty():
        failure_reasons.append("face_detector_unavailable")
        report["failure_reasons"] = failure_reasons
        return report

    faces = _FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(config.min_face_size, config.min_face_size),
    )
    face_detected = len(faces) > 0
    report["face_detected"] = face_detected
    if not face_detected:
        failure_reasons.append("face_not_detected")
    else:
        largest_face = max(faces, key=lambda f: int(f[2]) * int(f[3]))
        x, y, w, h = [int(v) for v in largest_face]

        face_center_x = x + (w / 2.0)
        face_center_y = y + (h / 2.0)
        image_center_x = width / 2.0
        image_center_y = height / 2.0

        face_center_norm_x = face_center_x / max(width, 1)
        face_center_norm_y = face_center_y / max(height, 1)
        center_offset = float(
            np.hypot(face_center_norm_x - 0.5, face_center_norm_y - 0.5)
        )
        max_center_offset = _max_center_offset_for_angle(config, angle)
        face_size_ratio = (float(w) * float(h)) / max(float(width * height), 1.0)

        report["center_offset"] = center_offset
        report["max_center_offset"] = max_center_offset
        report["face_size_ratio"] = face_size_ratio

        face_centered = center_offset <= max_center_offset
        report["face_centered"] = face_centered
        if not face_centered:
            failure_reasons.append(
                "face_off_center"
                f"(center_offset:{center_offset:.3f},max:{max_center_offset:.3f})"
            )

        face_large_enough = face_size_ratio >= config.min_face_area_ratio
        if not face_large_enough:
            failure_reasons.append(
                "face_too_small"
                f"(ratio:{face_size_ratio:.3f},min:{config.min_face_area_ratio:.3f})"
            )

    # Eyes-visible check is intentionally explicit for this phase.
    report["eyes_visible"] = "not_yet_implemented"

    passed = (
        report["dimensions_ok"]
        and report["blur_ok"]
        and report["brightness_ok"]
        and report["face_detected"]
        and report["face_centered"]
        and (
            report["face_size_ratio"] is None
            or float(report["face_size_ratio"]) >= config.min_face_area_ratio
        )
    )
    report["passed"] = passed
    report["failure_reasons"] = failure_reasons
    report["blocker"] = _reason_code(failure_reasons[0]) if failure_reasons else "ready"

    return report


def build_validation_summary(image_reports: list[dict[str, Any]]) -> dict[str, Any]:
    total_images_checked = len(image_reports)
    total_images_passed = sum(1 for report in image_reports if bool(report.get("passed")))
    failed_images_count = total_images_checked - total_images_passed
    validation_passed = failed_images_count == 0

    return {
        "validation_passed": validation_passed,
        "total_images_checked": total_images_checked,
        "total_images_passed": total_images_passed,
        "failed_images_count": failed_images_count,
        "image_reports": image_reports,
    }
