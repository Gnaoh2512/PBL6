"""Typed inputs for the recommendation application flow."""

from ai_service.application.recommendation.models import (
    AvailabilitySearchRequest,
    RecommendationPreferences,
    RecommendationRequest,
    RecommendationResult,
    RecommendationRoomType,
    RecommendationStatus,
    RecommendedRoom,
    SortBy,
)

__all__ = [
    "AvailabilitySearchRequest",
    "RecommendedRoom",
    "RecommendationPreferences",
    "RecommendationRequest",
    "RecommendationResult",
    "RecommendationRoomType",
    "RecommendationStatus",
    "SortBy",
]
