import os
import tempfile

os.environ.setdefault("LAB_SECRET", "test-secret-not-for-production")
os.environ.setdefault("LAB_DATA_DIR", tempfile.mkdtemp())
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "100000")
os.environ.setdefault("FLAG_RATE_LIMIT_PER_MINUTE", "100000")
# The repository .env is for local development and may configure JWT auth.
# The suite's default must stay in the historical open test mode, or every lab
# request returns 401; auth-specific tests set these values explicitly.
os.environ["JWT_SECRET"] = ""
os.environ["AUTH_REQUIRED"] = "0"
os.environ.pop("ADMIN_EMAIL", None)
os.environ.pop("ADMIN_PASSWORD", None)
os.environ.pop("COOKIE_SECURE", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(create_app())
