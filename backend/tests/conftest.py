from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from suryakavach.api import app


@pytest.fixture(scope="session")
def client():
    """A TestClient that runs the app's lifespan.

    Engine boot happens in the lifespan handler (not at import), so a bare
    ``TestClient(app)`` would leave the runtime unbooted and every route would
    answer 503. Session-scoped because booting takes a few seconds.
    """
    with TestClient(app) as c:
        yield c
