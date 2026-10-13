import os
import tempfile

os.environ.setdefault("LAB_SECRET", "test-secret-not-for-production")
os.environ.setdefault("LAB_DATA_DIR", tempfile.mkdtemp())
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "100000")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(create_app())
