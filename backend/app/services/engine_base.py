"""Shared engine exception (kept separate so clients and dispatch can both import it)."""
from __future__ import annotations


class EngineUnavailable(RuntimeError):
    """A configured model engine could not serve the request."""
