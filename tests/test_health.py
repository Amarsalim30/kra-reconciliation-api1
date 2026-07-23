import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import get_db

@pytest.fixture(name="client")
def fixture_client():
    with TestClient(app) as test_client:
        yield test_client

def test_health_endpoint_healthy(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"
    assert "version" in data

def test_health_endpoint_db_failure(client: TestClient):
    # Simulate DB error by patching SessionLocal in main
    from unittest.mock import patch, MagicMock
    with patch("app.database.database.SessionLocal") as mock_session:
        mock_session.side_effect = Exception("DB Connection Refused")
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unhealthy"
        assert "unhealthy" in data["database"]
