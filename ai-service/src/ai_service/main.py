"""FastAPI application entry point."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from ai_service import __version__
from ai_service.config import get_settings
from ai_service.infrastructure.backend import BackendClient
from ai_service.infrastructure.logging import configure_logging
from ai_service.presentation.http.body_limit import RecommendationBodyLimitMiddleware
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
        yield
    logger.info("AI service stopped")


app = FastAPI(
    title=f"PBL6 {settings.app_name}",
    description="Room recommendations from live backend availability. Chat is not implemented yet.",
    version=__version__,
    lifespan=lifespan,
)
app.include_router(health_router)
app.include_router(recommendations_router)
app.add_exception_handler(ApiError, api_error_response)
app.add_exception_handler(RequestValidationError, validation_error_response)
app.add_middleware(RecommendationBodyLimitMiddleware)
