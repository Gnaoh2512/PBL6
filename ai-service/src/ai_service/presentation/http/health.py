"""Dependency-free health endpoint."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ai_service import __version__
from ai_service.config import Settings, get_settings

router = APIRouter(tags=["operations"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Report process health without contacting backend, database, or AI providers."""

    return HealthResponse(status="ok", service=settings.app_name, version=__version__)
