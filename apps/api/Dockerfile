FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/app \
    INSIGHTFACE_ROOT=/app/.insightface \
    INSIGHTFACE_MODEL_PACK=antelopev2 \
    MPLCONFIGDIR=/tmp/matplotlib

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

RUN mkdir -p "$INSIGHTFACE_ROOT" "$MPLCONFIGDIR" && \
    python - <<'PY'
import os

from insightface.app import FaceAnalysis

root = os.environ["INSIGHTFACE_ROOT"]
pack = os.environ.get("INSIGHTFACE_MODEL_PACK", "antelopev2").strip().strip("/")
candidates = [pack]
if "/" not in pack:
    candidates.append(f"{pack}/{pack}")

last_error = None
for name in dict.fromkeys(candidates):
    try:
        app = FaceAnalysis(
            name=name,
            root=root,
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=-1, det_size=(640, 640))
        tasks = set(app.models.keys())
        missing = {"detection", "recognition"} - tasks
        if missing:
            raise RuntimeError(f"missing InsightFace tasks: {sorted(missing)}")
        print(
            "InsightFace model prebaked",
            {"name": name, "root": root, "tasks": sorted(tasks)},
        )
        break
    except Exception as exc:  # noqa: BLE001
        last_error = exc
else:
    raise RuntimeError(f"Failed to prebake InsightFace model {pack}: {last_error}")
PY

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read()"

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--access-logfile", "-", "--error-logfile", "-", "--log-level", "info", "--timeout", "120"]
