"""Authenticated natural-language recommendation endpoint."""

from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from ai_service.application.recommendation.conversation_models import (
    ConversationRequest,
    ConversationResponse,
)
from ai_service.application.recommendation.conversation_service import ConversationService
from ai_service.config import Settings, get_settings
from ai_service.infrastructure.backend.errors import BackendClientError
from ai_service.infrastructure.llm import (
    ExtractionInvalidResponse,
    ExtractionTimeout,
    ExtractionUnavailable,
)
from ai_service.presentation.http.recommendations import (
    ApiError,
    map_backend_error,
    require_request_id,
    require_service_token,
)

router = APIRouter(prefix="/api/v1/ai/recommendations", tags=["recommendations"])


@router.post("/conversation", response_model=ConversationResponse)
async def converse(
    payload: ConversationRequest,
    request: Request,
    _: Annotated[None, Depends(require_service_token)],
    request_id: Annotated[str, Depends(require_request_id)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    backend = getattr(request.app.state, "backend_client", None)
    extractor = getattr(request.app.state, "extractor", None)
    if backend is None:
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Recommendation service is not ready")
    if extractor is None:
        raise ApiError(503, "LLM_NOT_CONFIGURED", "Language extraction is not configured")
    try:
        result = await ConversationService(
            backend, extractor, timezone=ZoneInfo(settings.hotel_timezone),
            scoring_config=settings.scoring_config,
        ).execute(payload, request_id=request_id)
    except ExtractionTimeout as exc:
        raise ApiError(504, "LLM_TIMEOUT", "Language extraction timed out") from exc
    except (ExtractionUnavailable, ExtractionInvalidResponse) as exc:
        raise ApiError(502, "LLM_UNAVAILABLE", "Language extraction failed") from exc
    except BackendClientError as exc:
        raise map_backend_error(exc) from exc
    return Response(
        content=result.to_contract_json(),
        media_type="application/json",
        headers={"X-Request-ID": request_id},
    )
