"""Local browser harness for exercising private recommendation endpoints."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

router = APIRouter(tags=["demo"])
DEMO_FILE = Path(__file__).parents[2] / "static" / "demo.html"


@router.get("/demo", include_in_schema=False)
async def demo(request: Request) -> FileResponse:
    if request.client is None or request.client.host not in ("127.0.0.1", "::1", "testclient"):
        raise HTTPException(status_code=404)
    return FileResponse(DEMO_FILE, media_type="text/html")
