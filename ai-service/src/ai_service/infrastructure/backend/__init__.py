"""Typed access to authoritative Spring backend APIs."""

from ai_service.infrastructure.backend.client import BackendClient
from ai_service.infrastructure.backend.errors import (
    BackendClientError,
    BackendConnectionError,
    BackendHttpError,
    BackendInvalidResponseError,
    BackendTimeoutError,
)
from ai_service.infrastructure.backend.models import AvailableRoomCandidate, BackendRoomType

__all__ = [
    "AvailableRoomCandidate",
    "BackendClient",
    "BackendClientError",
    "BackendConnectionError",
    "BackendHttpError",
    "BackendInvalidResponseError",
    "BackendRoomType",
    "BackendTimeoutError",
]
