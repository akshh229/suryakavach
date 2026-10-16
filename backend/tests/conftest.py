from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from suryakavach.api import app


@pytest.fixture(scope="session")
def client():
    """A TestClient that runs the app's lifespan.

    The app deliberately serves liveness while boot runs in the background.
    Engine-route tests therefore wait for the explicit readiness contract
    instead of relying on lifespan startup to block.
    """
    with TestClient(app) as c:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            response = c.get("/api/ready")
            if response.status_code == 200:
                break
            time.sleep(0.1)
        else:
            pytest.fail(f"runtime did not become ready: {c.get('/api/ready').json()}")
        yield c
