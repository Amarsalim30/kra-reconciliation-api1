import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.database.database import get_db
from app.main import app

# Setup test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="db_session", scope="function")
def fixture_db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client", scope="function")
def fixture_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_register_user(client):
    # Register user successfully
    payload = {
        "username": "tester",
        "password": "securepassword123",
        "email": "tester@example.com",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "tester"
    assert data["email"] == "tester@example.com"
    assert data["is_active"] is True
    assert "id" in data

    # Try registering same username again
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "Username already registered"


def test_login_json(client):
    # Register user
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
        "email": "tester@example.com",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # Login with JSON payload
    login_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_form(client):
    # Register user
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
        "email": "tester@example.com",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # Login with Form-encoded payload
    login_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/token", data=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    # Register user
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    # Login with incorrect password
    login_payload = {
        "username": "tester",
        "password": "wrongpassword",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"


def test_get_current_user_profile(client):
    # Register and Login
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    login_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    token = response.json()["access_token"]

    # Access protected profile route
    headers = {"Authorization": f"Bearer {token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "tester"
    assert data["is_active"] is True


def test_refresh_token_rotation(client):
    # Register and Login
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    login_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    tokens = response.json()
    first_access = tokens["access_token"]
    first_refresh = tokens["refresh_token"]

    # Rotate token
    refresh_payload = {"refresh_token": first_refresh}
    response = client.post("/api/v1/auth/refresh", json=refresh_payload)
    assert response.status_code == 200
    new_tokens = response.json()
    second_access = new_tokens["access_token"]
    second_refresh = new_tokens["refresh_token"]

    assert second_access != first_access
    assert second_refresh != first_refresh

    # Try rotating with old refresh token (should be invalid/revoked)
    response = client.post("/api/v1/auth/refresh", json=refresh_payload)
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired refresh token"


def test_logout(client):
    # Register and Login
    register_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    client.post("/api/v1/auth/register", json=register_payload)

    login_payload = {
        "username": "tester",
        "password": "securepassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    refresh_token = response.json()["refresh_token"]

    # Logout
    logout_payload = {"refresh_token": refresh_token}
    response = client.post("/api/v1/auth/logout", json=logout_payload)
    assert response.status_code == 200
    assert response.json()["detail"] == "Successfully logged out"

    # Verify token is now invalid for refresh
    refresh_payload = {"refresh_token": refresh_token}
    response = client.post("/api/v1/auth/refresh", json=refresh_payload)
    assert response.status_code == 401
