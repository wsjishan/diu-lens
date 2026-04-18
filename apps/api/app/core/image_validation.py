from dataclasses import dataclass
from typing import Any, Literal

import cv2
import numpy as np


EyesVisibleStatus = Literal["passed", "failed", "not_yet_implemented"]


@dataclass(frozen=True)
class ImageValidationConfig:
    min_blur_variance: float = 80.0
    min_brightness: float = 40.0
    max_brightness: float = 220.0
    min_width: int = 224
    min_height: int = 224
    min_face_size: int = 40
    max_center_offset_ratio_x: float = 0.25
    max_center_offset_ratio_y: float = 0.25


_CONFIG = ImageValidationConfig()
_FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)


def _default_report(file_name: str, angle: str) -> dict[str, Any]:
    return {
        "file_name": file_name,
        "angle": angle,
        "passed": False,
        "blur_ok": False,
        "brightness_ok": False,
        "dimensions_ok": False,
        "face_detected": False,
        "face_centered": False,
        "eyes_visible": "not_yet_implemented",
        "failure_reasons": [],
    }


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

        offset_x = abs(face_center_x - image_center_x) / max(width, 1)
        offset_y = abs(face_center_y - image_center_y) / max(height, 1)
        face_centered = (
            offset_x <= config.max_center_offset_ratio_x
            and offset_y <= config.max_center_offset_ratio_y
        )
        report["face_centered"] = face_centered
        if not face_centered:
            failure_reasons.append(
                "face_off_center"
                f"(offset_x:{offset_x:.3f},offset_y:{offset_y:.3f},"
                f"max_x:{config.max_center_offset_ratio_x:.3f},"
                f"max_y:{config.max_center_offset_ratio_y:.3f})"
            )

    # Eyes-visible check is intentionally explicit for this phase.
    report["eyes_visible"] = "not_yet_implemented"

    passed = (
        report["dimensions_ok"]
        and report["blur_ok"]
        and report["brightness_ok"]
        and report["face_detected"]
        and report["face_centered"]
    )
    report["passed"] = passed
    report["failure_reasons"] = failure_reasons

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
