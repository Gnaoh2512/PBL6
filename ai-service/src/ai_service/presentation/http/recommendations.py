"""Authenticated HTTP boundary for live room recommendations."""

import secrets
from typing import Annotated
from uuid import uuid4

import simplejson
from fastapi import APIRouter, Depends, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ai_service.application.recommendation import RecommendationRequest, RecommendationResult
from ai_service.application.recommendation.amenities import CATALOG, AmenityCriteriaError
from ai_service.application.recommendation.pipeline import RecommendationPipeline
from ai_service.application.recommendation.scoring import MultiCriteriaScorer
from ai_service.application.request_id import validate_request_id
from ai_service.config import Settings, get_settings
from ai_service.infrastructure.backend.errors import (
    BackendClientError,
    BackendHttpError,
    BackendTimeoutError,
)

router = APIRouter(prefix="/api/v1/ai", tags=["recommendations"])
service_bearer = HTTPBearer(auto_error=False, scheme_name="ServiceToken")


class ApiError(Exception):
    """Safe public error category for the AI HTTP contract."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message


def request_id_for_error(request: Request) -> str:
    """Reuse a valid caller ID, or generate one for malformed/missing headers."""

    value = request.headers.get("X-Request-ID")
    if value is not None:
        try:
            return validate_request_id(value)
        except ValueError:
            pass
    return str(uuid4())


def error_response(
    *, status_code: int, code: str, message: str, request_id: str, details: object = None
) -> Response:
    return Response(
        content=simplejson.dumps(
            {
                "error": {
                    "code": code,
                    "message": message,
                    "requestId": request_id,
                    "details": details,
                }
            },
            separators=(",", ":"),
        ),
        status_code=status_code,
        media_type="application/json",
        headers={"X-Request-ID": request_id},
    )


async def validation_error_response(request: Request, exc: RequestValidationError) -> Response:
    """Report field errors without echoing request values or provider internals."""

    details = []
    for error in exc.errors():
        cause = error.get("ctx", {}).get("error")
        if isinstance(cause, AmenityCriteriaError):
            detail = {
                "field": f"body.{cause.field}",
                "type": "UNKNOWN_AMENITY" if cause.reason == "UNKNOWN" else "AMENITY_CONFLICT",
            }
            if cause.reason == "UNKNOWN":
                detail["supportedCodes"] = sorted(CATALOG)
            details.append(detail)
        else:
            details.append(
                {"field": ".".join(str(part) for part in error["loc"]), "type": error["type"]}
            )
    return error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="Invalid recommendation request",
        request_id=request_id_for_error(request),
        details=details,
    )


async def api_error_response(request: Request, exc: ApiError) -> Response:
    return error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        request_id=request_id_for_error(request),
    )


def require_service_token(
    settings: Annotated[Settings, Depends(get_settings)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(service_bearer)],
) -> None:
    expected = settings.ai_service_auth_token
    if expected is None or not expected.get_secret_value():
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Recommendation service is not configured")

    if credentials is None or not secrets.compare_digest(
        credentials.credentials, expected.get_secret_value()
    ):
        raise ApiError(401, "SERVICE_UNAUTHORIZED", "Unauthorized")


def require_request_id(value: Annotated[str, Header(alias="X-Request-ID")]) -> str:
    try:
        return validate_request_id(value)
    except ValueError as exc:
        raise ApiError(422, "VALIDATION_ERROR", "Invalid X-Request-ID") from exc


def map_backend_error(exc: BackendClientError) -> ApiError:
    if isinstance(exc, BackendTimeoutError):
        return ApiError(504, "BACKEND_TIMEOUT", "Current room availability could not be retrieved")
    if isinstance(exc, BackendHttpError) and exc.status_code in (400, 422):
        return ApiError(422, "BACKEND_REJECTED_REQUEST", "Backend rejected the search criteria")
    return ApiError(502, "BACKEND_UNAVAILABLE", "Current room availability could not be retrieved")


@router.post(
    "/recommendations",
    response_model=RecommendationResult,
    responses={
        401: {"description": "Invalid service token"},
        413: {"description": "Request body exceeds 16 KiB"},
        422: {"description": "Invalid request"},
        502: {"description": "Backend unavailable"},
        503: {"description": "Service not configured or ready"},
        504: {"description": "Backend timeout"},
    },
)
async def recommend_rooms(
    payload: RecommendationRequest,
    request: Request,
    _: Annotated[None, Depends(require_service_token)],
    request_id: Annotated[str, Depends(require_request_id)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    """Return ranked concrete rooms from one live Spring availability query."""

    backend_client = getattr(request.app.state, "backend_client", None)
    if backend_client is None:
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Recommendation service is not ready")

    try:
        result = await RecommendationPipeline(
            backend_client, scorer=MultiCriteriaScorer(settings.scoring_config)
        ).execute(
            payload, request_id=request_id
        )
    except BackendClientError as exc:
        raise map_backend_error(exc) from exc

    return Response(
        content=result.to_contract_json(),
        media_type="application/json",
        headers={"X-Request-ID": request_id},
    )
