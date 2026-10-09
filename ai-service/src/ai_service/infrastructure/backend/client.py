"""Reusable asynchronous client for public Spring backend data."""

from typing import Any

import httpx
import simplejson
from pydantic import ValidationError

from ai_service.application.recommendation import AvailabilitySearchRequest
from ai_service.application.request_id import validate_request_id
from ai_service.config import Settings
from ai_service.infrastructure.backend.errors import (
    BackendConnectionError,
    BackendHttpError,
    BackendInvalidResponseError,
    BackendTimeoutError,
)
from ai_service.infrastructure.backend.models import AvailableRoomCandidate, BackendApiResponse

AVAILABILITY_PATH = "/api/public/rooms/available"


class BackendClient:
    """Own one connection pool and expose typed backend operations."""

    def __init__(
        self,
        *,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(timeout_seconds),
            transport=transport,
        )

    @classmethod
    def from_settings(cls, settings: Settings) -> "BackendClient":
        return cls(
            base_url=str(settings.backend_api_url),
            timeout_seconds=settings.backend_request_timeout_seconds,
        )

    @property
    def is_closed(self) -> bool:
        return self._http.is_closed

    async def __aenter__(self) -> "BackendClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._http.aclose()

    async def find_available_rooms(
        self,
        search: AvailabilitySearchRequest,
        *,
        request_id: str,
    ) -> list[AvailableRoomCandidate]:
        """Return live candidates; an empty list is a valid, distinct result."""

        request_id = validate_request_id(request_id)
        payload = search.model_dump(by_alias=True, exclude_none=True)
        payload["checkInDate"] = search.check_in_date.isoformat()
        payload["checkOutDate"] = search.check_out_date.isoformat()
        content = simplejson.dumps(payload, use_decimal=True, separators=(",", ":"))

        try:
            response = await self._http.post(
                AVAILABILITY_PATH,
                content=content,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Request-ID": request_id,
                },
            )
        except httpx.TimeoutException as exc:
            raise BackendTimeoutError("backend availability request timed out") from exc
        except httpx.RequestError as exc:
            raise BackendConnectionError("backend availability connection failed") from exc

        if not 200 <= response.status_code < 300:
            raise BackendHttpError(response.status_code)

        try:
            raw: Any = simplejson.loads(response.content, use_decimal=True)
            envelope = BackendApiResponse[list[AvailableRoomCandidate]].model_validate(raw)
        except (simplejson.JSONDecodeError, UnicodeDecodeError, ValidationError) as exc:
            raise BackendInvalidResponseError(
                "backend availability response did not match its DTO"
            ) from exc

        if not envelope.success or envelope.data is None:
            raise BackendInvalidResponseError(
                "backend availability response was not a successful data envelope"
            )
        return envelope.data
