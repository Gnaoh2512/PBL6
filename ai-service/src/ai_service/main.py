"""FastAPI application entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from ai_service import __version__
from ai_service.config import get_settings
from ai_service.infrastructure.backend import BackendClient
from ai_service.infrastructure.llm import GeminiExtractor
from ai_service.infrastructure.logging import configure_logging
from ai_service.presentation.http.body_limit import RecommendationBodyLimitMiddleware
from ai_service.presentation.http.conversation import router as conversation_router
from ai_service.presentation.http.demo import router as demo_router
from ai_service.presentation.http.health import router as health_router
from ai_service.presentation.http.recommendations import (
    ApiError,
    api_error_response,
    validation_error_response,
)
from ai_service.presentation.http.recommendations import router as recommendations_router

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    logger.info("AI service started (environment=%s)", settings.app_env)
    async with BackendClient.from_settings(settings) as backend_client:
        application.state.backend_client = backend_client
        token = settings.gemini_api_key
        extractor = (
            GeminiExtractor(
                api_key=token.get_secret_value(),
                model=settings.gemini_model,
                timezone_name=settings.hotel_timezone,
                timeout_seconds=settings.gemini_request_timeout_seconds,
            )
            if token is not None and token.get_secret_value()
            else None
        )
        application.state.extractor = extractor
        try:
            yield
        finally:
            if extractor is not None:
                await extractor.aclose()
    logger.info("AI service stopped")


app = FastAPI(
    title=f"PBL6 {settings.app_name}",
    description="Structured and Vietnamese-language room recommendations from live backend availability.",
    version=__version__,
    lifespan=lifespan,
)
app.include_router(health_router)
app.include_router(recommendations_router)
app.include_router(conversation_router)
app.include_router(demo_router)
app.add_exception_handler(ApiError, api_error_response)
app.add_exception_handler(RequestValidationError, validation_error_response)
app.add_middleware(RecommendationBodyLimitMiddleware)
