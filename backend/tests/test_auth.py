import pytest
from app.models.user import User

def test_register_success(client, db):
    payload = {
        "email": "newuser@example.com",
        "username": "newuser",
        "password": "strongpassword123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["email"] == payload["email"]
    assert data["username"] == payload["username"]
    assert "id" in data
    
    # Verify DB entry
    db_user = db.query(User).filter(User.email == payload["email"]).first()
    assert db_user is not None
    assert db_user.username == payload["username"]

def test_register_duplicate_email(client, test_user):
    payload = {
        "email": test_user["email"], # duplicate email
        "username": "distinctusername",
        "password": "somepassword123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_register_duplicate_username(client, test_user):
    payload = {
        "email": "distinctemail@example.com",
        "username": test_user["username"], # duplicate username
        "password": "somepassword123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_login_success(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": test_user["email"],
            "password": test_user["password"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_login_failure(client, test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": test_user["email"],
            "password": "wrongpassword",
        },
    )
    assert response.status_code == 400
    assert "Incorrect" in response.json()["detail"]

def test_refresh_token_success(client, test_user):
    # Log in first
    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": test_user["email"],
            "password": test_user["password"],
        },
    )
    refresh_token = login_resp.json()["refresh_token"]

    # Refresh
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    data = refresh_resp.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_read_profile_me(client, auth_headers, test_user):
    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
    assert data["username"] == test_user["username"]

def test_update_profile_me(client, auth_headers, test_user, db):
    payload = {
        "username": "updatedusername",
        "email": "updatedemail@example.com",
        "password": "newpassword123",
    }
    response = client.put("/api/v1/users/me", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == payload["username"]
    assert data["email"] == payload["email"]
    
    # Check DB
    db_user = db.query(User).filter(User.id == test_user["user"].id).first()
    assert db_user.username == payload["username"]
    assert db_user.email == payload["email"]
