"""FastAPI foundation. No LLM, retrieval engine, database or fake answer provider."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.api.boundary import FoundationBoundary, error_response
from app.schemas.turn import ResumeTurn, TurnPayload
from app.settings import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    application = FastAPI(
        title="Hotel Assistant Foundation",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        redirect_slashes=False,
    )
    application.add_middleware(FoundationBoundary, settings=settings)

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exception: RequestValidationError):
        invalid_json = any(item["type"] == "json_invalid" for item in exception.errors())
        return error_response(
            request.state.request_id,
            400 if invalid_json else 422,
            "INVALID_JSON" if invalid_json else "VALIDATION_ERROR",
        )

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exception: HTTPException):
        code = {
            400: "INVALID_JSON",
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
        }.get(exception.status_code, "HTTP_ERROR")
        return error_response(request.state.request_id, exception.status_code, code)

    @application.get("/health")
    async def health():
        return {"status": "alive"}

    @application.get("/ready")
    async def ready():
        return JSONResponse(
            {
                "status": "not_ready",
                "profile": "faq",
                "corpusMode": settings.corpus_mode,
                "checks": {
                    "configuration": settings.service_token is not None,
                    "llm": False,
                    "retrieval": False,
                },
            },
            status_code=503,
        )

    @application.post("/internal/assistant/turn")
    async def turn(payload: TurnPayload, request: Request):
        if payload.requestId != request.state.request_id:
            return error_response(request.state.request_id, 422, "VALIDATION_ERROR")
        if isinstance(payload, ResumeTurn):
            # No continuations can exist until orchestration is implemented.
            return error_response(request.state.request_id, 409, "CONTINUATION_NOT_FOUND")
        return error_response(
            request.state.request_id, 503, "DEPENDENCY_UNAVAILABLE", retryable=True
        )

    return application
