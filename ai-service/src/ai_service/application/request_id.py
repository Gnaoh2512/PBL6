"""Validation shared by outbound calls that participate in request tracing."""

import re

REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def validate_request_id(request_id: str) -> str:
    """Validate the restricted request-ID syntax in the draft integration contract."""

    if not REQUEST_ID_PATTERN.fullmatch(request_id):
        raise ValueError(
            "X-Request-ID must contain 1-64 ASCII letters, digits, dots, underscores, or hyphens"
        )
    return request_id
