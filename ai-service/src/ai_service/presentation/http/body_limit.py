"""Bound recommendation request bodies before FastAPI parses JSON."""

from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from ai_service.presentation.http.recommendations import error_response, request_id_for_error

MAX_RECOMMENDATION_BODY_BYTES = 16 * 1024
RECOMMENDATION_PATH = "/api/v1/ai/recommendations"


class RecommendationBodyLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"] != RECOMMENDATION_PATH:
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        content_length = request.headers.get("Content-Length")
        try:
            declared_length = int(content_length) if content_length is not None else 0
        except ValueError:
            declared_length = 0

        if declared_length > MAX_RECOMMENDATION_BODY_BYTES:
            await self._reject(scope, receive, send, request)
            return

        buffered_body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            buffered_body.extend(message.get("body", b""))
            if len(buffered_body) > MAX_RECOMMENDATION_BODY_BYTES:
                await self._reject(scope, receive, send, request)
                return
            if not message.get("more_body", False):
                break

        body_not_replayed = True

        async def replay_receive() -> Message:
            nonlocal body_not_replayed
            if body_not_replayed:
                body_not_replayed = False
                return {"type": "http.request", "body": bytes(buffered_body), "more_body": False}
            return await receive()

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def _reject(scope: Scope, receive: Receive, send: Send, request: Request) -> None:
        response = error_response(
            status_code=413,
            code="REQUEST_TOO_LARGE",
            message="Recommendation request is too large",
            request_id=request_id_for_error(request),
        )
        await response(scope, receive, send)
