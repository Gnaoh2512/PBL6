"""Host-injected verification core. It does not activate or configure the FAQ endpoint."""

from .catalog import VerifiedCatalog
from .gate import VerificationGate

__all__ = ["VerifiedCatalog", "VerificationGate"]
