import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.models.user import User

# Use an in-memory SQLite database for fast unit testing
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test function."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def client(db):
    """Override get_db dependency and return a TestClient."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture(scope="function")
def test_user(db):
    """Fixture that creates a test user and returns their credentials."""
    password = "testpassword123"
    hashed_pwd = get_password_hash(password)
    user = User(
        email="testuser@example.com",
        username="testuser",
        hashed_password=hashed_pwd,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {
        "user": user,
        "email": user.email,
        "username": user.username,
        "password": password,
    }

@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    """Fixture that logs in the test user and returns authorization headers."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": test_user["email"],
            "password": test_user["password"],
        },
    )
    assert response.status_code == 200
    token_data = response.json()
    return {"Authorization": f"Bearer {token_data['access_token']}"}
