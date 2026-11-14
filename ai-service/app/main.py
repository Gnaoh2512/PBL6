"""Internal FAQ runtime. Never connects to the business database or accepts customer JWTs."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.api.boundary import FoundationBoundary, error_response
from app.diagnostics import Operation, Phase, context, step
from app.orchestration.faq import Faq
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.retrieval.index import KnowledgeIndex
from app.schemas.faq import Probe
from app.schemas.turn import ResumeTurn, TurnPayload
from app.settings import Settings


def create_app(settings: Settings | None = None, *, faq=None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    state = {"faq": faq, "provider": None, "dependency_failed": False}

    async def initialize():
        if (
            state["faq"] is None
            and settings.gemini_key
            and settings.index_path
            and settings.service_token
        ):
            try:
                index = KnowledgeIndex(
                    settings.index_path,
                    settings.corpus_mode,
                    datetime.now(timezone(timedelta(hours=7))).date(),
                )
                provider = Gemini(settings.gemini_key.get_secret_value(), settings.gemini_model)
                state["provider"] = provider
                budget = TurnBudget(remaining_ms=5000, output_limit=100)
                with (
                    context(operation=Operation.PROBE, budget=budget, new=True),
                    step(Phase.APPLICATION),
                ):
                    probe = await provider.generate("Return ok=true.", {}, Probe, budget)
                    if not probe.ok:
                        raise DependencyError()
                state["faq"] = Faq(provider, index, settings.corpus_mode)
            except (DependencyError, OSError, ValueError):
                state["faq"] = None

    @asynccontextmanager
    async def lifespan(app):
        try:
            await initialize()
            yield
        finally:
            if state["provider"]:
                await state["provider"].close()

    application = FastAPI(
        title="Hotel Assistant Foundation",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        redirect_slashes=False,
        lifespan=lifespan,
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
        retrieval = state["faq"] is not None
        if retrieval:
            try:
                state["faq"].index.validate(datetime.now(timezone(timedelta(hours=7))).date())
            except DependencyError:
                retrieval = False
        llm = state["faq"] is not None and not state["dependency_failed"]
        ready = llm and retrieval and settings.service_token is not None
        return JSONResponse(
            {
                "status": "ready" if ready else "not_ready",
                "profile": "faq",
                "corpusMode": settings.corpus_mode,
                "checks": {
                    "configuration": settings.service_token is not None,
                    "llm": llm,
                    "retrieval": retrieval,
                },
            },
            status_code=200 if ready else 503,
        )

    @application.post("/internal/assistant/turn")
    async def turn(payload: TurnPayload, request: Request):
        if payload.requestId != request.state.request_id:
            return error_response(request.state.request_id, 422, "VALIDATION_ERROR")
        if isinstance(payload, ResumeTurn):
            # No continuations can exist until orchestration is implemented.
            return error_response(request.state.request_id, 409, "CONTINUATION_NOT_FOUND")
        if state["faq"] is not None and not state["dependency_failed"]:
            try:
                return await state["faq"].run(payload)
            except TimeoutError:
                return error_response(
                    request.state.request_id, 504, "DEADLINE_EXCEEDED", retryable=True
                )
            except DependencyError as error:
                if error.code == "DEPENDENCY_UNAVAILABLE":
                    state["dependency_failed"] = True
                status = {"DEADLINE_EXCEEDED": 504, "AI_PROTOCOL_ERROR": 502}.get(error.code, 503)
                return error_response(request.state.request_id, status, error.code, retryable=True)
        return error_response(
            request.state.request_id, 503, "DEPENDENCY_UNAVAILABLE", retryable=True
        )

    return application
