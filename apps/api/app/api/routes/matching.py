from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials

from app.core.auth import bearer_scheme, require_admin
from app.core.face_matching import FaceMatchingError, match_face_probe
from app.core.storage import ALLOWED_IMAGE_CONTENT_TYPES, MAX_UPLOAD_IMAGE_SIZE_BYTES


router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/recognition/match")
async def admin_match_face(
    image: UploadFile = File(...),
    threshold: float | None = Query(default=None, gt=0),
    top_k: int | None = Query(default=None, gt=0),
    candidate_pool_limit: int | None = Query(default=None, gt=0),
    debug: bool = Query(default=False),
    probe_label: str | None = Query(default=None, max_length=120),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, object]:
    require_admin(credentials)

    content_type = (image.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Unsupported image type for matching probe.",
            },
        )

    probe_bytes = await image.read(MAX_UPLOAD_IMAGE_SIZE_BYTES + 1)
    await image.close()

    if not probe_bytes:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Probe image is empty."},
        )

    if len(probe_bytes) > MAX_UPLOAD_IMAGE_SIZE_BYTES:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Probe image exceeds size limit."},
        )

    try:
        result = match_face_probe(
            probe_bytes,
            threshold=threshold,
            top_k=top_k,
            candidate_pool_limit=candidate_pool_limit,
            debug=debug,
            probe_label=probe_label,
        )
    except FaceMatchingError as exc:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(exc)},
        )

    return {
        "success": True,
        "message": "Face match search completed.",
        **result,
    }
