"""`/readyz` is unauthenticated — its body must not leak config surface.

The route sits in `auth._PUBLIC_PATHS`, so anything it returns is readable by
any caller on the internet. It used to hand back `env`, `allowedInvokerCount`,
`liveKeyCount` and `shadowKeyCount`: a free read of our auth posture and key-
pool depth. Probes only need the status code.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


@pytest.fixture
def client() -> TestClient:
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    return TestClient(app)


class TestReadyzRedaction:
    def test_body_is_status_only(self, client: TestClient) -> None:
        res = client.get("/readyz")
        assert res.status_code == 200, res.text
        assert res.json() == {"status": "ok"}

    def test_no_config_fields_leak(self, client: TestClient) -> None:
        """Named guard so a future 'helpful' field addition trips a test."""
        body = client.get("/readyz").json()
        for leaked in (
            "env",
            "allowedInvokerCount",
            "liveKeyCount",
            "shadowKeyCount",
        ):
            assert leaked not in body
