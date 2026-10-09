"""Stable error categories for backend integration failures."""


class BackendClientError(Exception):
    """Base class for failures while querying the Spring backend."""


class BackendTimeoutError(BackendClientError):
    """The backend did not answer within the configured timeout."""


class BackendConnectionError(BackendClientError):
    """The backend connection could not be established or completed."""


class BackendHttpError(BackendClientError):
    """The backend returned a non-successful HTTP status."""

    def __init__(self, status_code: int) -> None:
        self.status_code = status_code
        super().__init__(f"backend returned HTTP {status_code}")


class BackendInvalidResponseError(BackendClientError):
    """The backend response was not a successful availability envelope."""
