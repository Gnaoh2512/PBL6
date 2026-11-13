"""ASGI boundary: authenticate before parsing and cap bytes even without Content-Length."""

import re
import secrets
from uuid import uuid4

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from app.settings import Settings

REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
MAX_BODY = 128 * 1024


def error_response(request_id: str, status: int, code: str, *, retryable=False):
    return JSONResponse(
        {
            "requestId": request_id,
            "error": {
                "code": code,
                "message": {
                    400: "Invalid JSON.",
                    401: "Service authentication required.",
                    409: "Continuation is not available.",
                    413: "Request body is too large.",
                    422: "Invalid request.",
                    503: "Service dependencies are not ready.",
                }.get(status, "Request could not be processed."),
                "retryable": retryable,
            },
        },
        status_code=status,
        headers={"X-Request-ID": request_id},
    )


class FoundationBoundary:
    def __init__(self, app, settings: Settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = Headers(scope=scope)
        request_id = headers.get("X-Request-ID")
        if request_id is not None and not REQUEST_ID.fullmatch(request_id):
            await error_response(str(uuid4()), 422, "VALIDATION_ERROR")(scope, receive, send)
            return
        request_id = request_id or str(uuid4())
        scope.setdefault("state", {})["request_id"] = request_id
        if scope["path"] == "/internal/assistant/turn":
            token = self.settings.service_token
            if token is None:
                await error_response(request_id, 503, "AI_NOT_CONFIGURED")(scope, receive, send)
                return
            supplied = headers.get("Authorization", "")
            expected = f"Bearer {token.get_secret_value()}"
            if not secrets.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
                await error_response(request_id, 401, "UNAUTHORIZED")(scope, receive, send)
                return
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > MAX_BODY:
                    await error_response(request_id, 413, "PAYLOAD_TOO_LARGE")(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            original_receive = receive

            async def buffered_receive():
                nonlocal body
                if body is not None:
                    result = {"type": "http.request", "body": bytes(body), "more_body": False}
                    body = None
                    return result
                return await original_receive()

            receive = buffered_receive

        started = False

        async def safe_send(message):
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
                existing = [
                    (k, v) for k, v in message.get("headers", []) if k.lower() != b"x-request-id"
                ]
                message["headers"] = existing + [(b"x-request-id", request_id.encode("ascii"))]
            await send(message)

        try:
            await self.app(scope, receive, safe_send)
        except Exception:  # noqa: BLE001 -- sanitize all failures at the ASGI boundary
            # Never propagate raw exception bodies/credentials to an access/server logger.
            if not started:
                await error_response(request_id, 500, "INTERNAL_ERROR")(scope, receive, send)
