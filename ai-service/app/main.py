"""Internal FAQ runtime. Never connects to the business database or accepts customer JWTs."""

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from app.api.boundary import FoundationBoundary, error_response
from app.diagnostics import Operation, Phase, context, step
from app.indexing import IndexingError
from app.orchestration.continuations import ContinuationNotFoundError
from app.orchestration.faq import Faq
from app.orchestration.verification.artifacts import load_verification_gate
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.retrieval.hybrid import create_hybrid_index
from app.retrieval.index import KnowledgeIndex
from app.schemas.faq import Probe
from app.schemas.turn import ResumeTurn, TurnPayload
from app.settings import Settings


def create_app(settings: Settings | None = None, *, faq=None) -> FastAPI:
    settings = settings if settings is not None else Settings()
    state = {
        "faq": faq,
        "provider": None,
        "dependency_failed": False,
        "dependency_failed_at": None,
        "retrieval": None,
    }

    def dependency_latched() -> bool:
        if not state["dependency_failed"]:
            return False
        cooldown = settings.dependency_latch_cooldown_s
        failed_at = state["dependency_failed_at"]
        if cooldown > 0 and failed_at is not None and monotonic() - failed_at >= cooldown:
            state["dependency_failed"] = False
            state["dependency_failed_at"] = None
            return False
        return True

    async def initialize():
        if (
            state["faq"] is None
            and settings.gemini_key
            and (settings.index_path or settings.retrieval_mode == "hybrid")
            and settings.service_token
        ):
            try:
                today = datetime.now(timezone(timedelta(hours=7))).date()
                if settings.retrieval_mode == "hybrid":
                    index = await create_hybrid_index(settings)
                    state["retrieval"] = index
                    await index.ready_async(today)
                else:
                    index = KnowledgeIndex(
                        settings.index_path,
                        settings.corpus_mode,
                        today,
                        source_pack=settings.demo_source_pack,
                    )
                gate = load_verification_gate(settings, index, today)
                gemini_kwargs = (
                    {"thinking_level": settings.gemini_thinking_level}
                    if settings.gemini_thinking_level is not None
                    else {}
                )
                if settings.gemini_transient_retries:
                    gemini_kwargs["transient_retries"] = settings.gemini_transient_retries
                    gemini_kwargs["retry_backoff_ms"] = settings.gemini_retry_backoff_ms
                provider = Gemini(
                    settings.gemini_key.get_secret_value(),
                    settings.gemini_model,
                    **gemini_kwargs,
                )
                state["provider"] = provider
                budget = TurnBudget(remaining_ms=5000, output_limit=100)
                with (
                    context(operation=Operation.PROBE, budget=budget, new=True),
                    step(Phase.APPLICATION),
                ):
                    probe = await provider.generate("Return ok=true.", {}, Probe, budget)
                    if not probe.ok:
                        raise DependencyError()
                state["faq"] = Faq(
                    provider,
                    index,
                    settings.corpus_mode,
                    verification_gate=gate,
                    grounding_config=settings.grounding,
                )
            except (DependencyError, IndexingError, OSError, ValueError):
                state["faq"] = None

    @asynccontextmanager
    async def lifespan(app):
        try:
            await initialize()
            yield
        finally:
            try:
                if state["provider"]:
                    await state["provider"].close()
            finally:
                if state["retrieval"]:
                    await state["retrieval"].close()

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
                if state["faq"].verification_gate is None:
                    raise DependencyError()
                state["faq"].verification_gate.catalog.check_current()
                if hasattr(state["faq"].index, "ready_async"):
                    await state["faq"].index.ready_async(
                        datetime.now(timezone(timedelta(hours=7))).date()
                    )
            except DependencyError:
                retrieval = False
        llm = state["faq"] is not None and not dependency_latched()
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
            if state["faq"] is None:
                return error_response(request.state.request_id, 409, "CONTINUATION_NOT_FOUND")
            try:
                return await state["faq"].resume(payload)
            except ContinuationNotFoundError:
                return error_response(request.state.request_id, 409, "CONTINUATION_NOT_FOUND")
            except TimeoutError:
                return error_response(
                    request.state.request_id, 504, "DEADLINE_EXCEEDED", retryable=True
                )
            except DependencyError as error:
                status = {"DEADLINE_EXCEEDED": 504, "AI_PROTOCOL_ERROR": 502}.get(error.code, 503)
                return error_response(request.state.request_id, status, error.code, retryable=True)
        if state["faq"] is not None and not dependency_latched():
            try:
                return await state["faq"].run(payload)
            except TimeoutError:
                return error_response(
                    request.state.request_id, 504, "DEADLINE_EXCEEDED", retryable=True
                )
            except DependencyError as error:
                if error.code == "DEPENDENCY_UNAVAILABLE":
                    state["dependency_failed"] = True
                    state["dependency_failed_at"] = monotonic()
                status = {"DEADLINE_EXCEEDED": 504, "AI_PROTOCOL_ERROR": 502}.get(error.code, 503)
                return error_response(request.state.request_id, status, error.code, retryable=True)
        return error_response(
            request.state.request_id, 503, "DEPENDENCY_UNAVAILABLE", retryable=True
        )

    return application
