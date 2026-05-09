"""Probe InsightFace runtime readiness from inside the API container."""

from __future__ import annotations

import json

from app.core.face_pipeline import FacePipelineError, validate_insightface_runtime


def main() -> int:
    try:
        report = validate_insightface_runtime()
    except FacePipelineError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2, sort_keys=True))
        return 1

    print(json.dumps({"ok": True, "report": report}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
