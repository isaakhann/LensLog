import pytest
from app.core.security import get_password_hash
from app.models.user import User
from app.models.photo import Photo
from app.models.social import Friendship, Like, Comment
from PIL import Image
from io import BytesIO

def _create_test_image() -> bytes:
    file = BytesIO()
    image = Image.new("RGB", (100, 100), color="blue")
    image.save(file, format="JPEG")
    file.seek(0)
    return file.read()

@pytest.fixture
def other_user(db):
    password = "otherpassword123"
    hashed_pwd = get_password_hash(password)
    user = User(
        email="other@example.com",
        username="otheruser",
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

@pytest.fixture
def other_headers(client, other_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": other_user["email"],
            "password": other_user["password"],
        },
    )
    assert response.status_code == 200
    token_data = response.json()
    return {"Authorization": f"Bearer {token_data['access_token']}"}

@pytest.fixture
def third_user(db):
    password = "thirdpassword123"
    hashed_pwd = get_password_hash(password)
    user = User(
        email="third@example.com",
        username="thirduser",
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

@pytest.fixture
def third_headers(client, third_user):
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": third_user["email"],
            "password": third_user["password"],
        },
    )
    assert response.status_code == 200
    token_data = response.json()
    return {"Authorization": f"Bearer {token_data['access_token']}"}


def test_user_search(client, auth_headers, other_user):
    # Search by username substring
    response = client.get("/api/v1/social/users/search?query=other", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["username"] == "otheruser"
    assert data[0]["friendship_status"] == "none"


def test_friend_request_flow(client, auth_headers, other_user, other_headers):
    friend_id = str(other_user["user"].id)

    # 1. Send friend request (A -> B)
    req_res = client.post(f"/api/v1/social/friends/request/{friend_id}", headers=auth_headers)
    assert req_res.status_code == 201

    # 2. Verify pending request lists
    # Incoming for B
    incoming_res = client.get("/api/v1/social/friends/pending", headers=other_headers)
    assert incoming_res.status_code == 200
    inc_data = incoming_res.json()
    assert len(inc_data["incoming"]) == 1
    assert inc_data["incoming"][0]["user_id"] == incoming_res.json()["incoming"][0]["user"]["id"] # A's id

    # Outgoing for A
    outgoing_res = client.get("/api/v1/social/friends/pending", headers=auth_headers)
    assert outgoing_res.status_code == 200
    out_data = outgoing_res.json()
    assert len(out_data["outgoing"]) == 1

    # 3. Accept friend request (B accepts A)
    user_a_id = out_data["outgoing"][0]["user_id"]
    accept_res = client.post(f"/api/v1/social/friends/accept/{user_a_id}", headers=other_headers)
    assert accept_res.status_code == 200

    # 4. Check active friends
    friends_res = client.get("/api/v1/social/friends", headers=auth_headers)
    assert friends_res.status_code == 200
    friends_data = friends_res.json()
    assert len(friends_data) == 1
    assert friends_data[0]["username"] == "otheruser"


def test_friend_privacy_access_control(
    client, auth_headers, other_user, other_headers, third_user, third_headers
):
    # A uploads a shared photo
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Shared with friends", "privacy_level": "shared"},
        files={"file": ("shared.jpg", img_bytes, "image/jpeg")},
    )
    assert up_res.status_code == 201
    photo_id = up_res.json()["id"]

    # 1. User C (third_headers, not a friend) tries to GET -> 403
    get_c = client.get(f"/api/v1/photos/{photo_id}", headers=third_headers)
    assert get_c.status_code == 403

    # 2. Make A and B friends
    friend_id = str(other_user["user"].id)
    client.post(f"/api/v1/social/friends/request/{friend_id}", headers=auth_headers)
    
    # Get A's ID to accept
    pending_res = client.get("/api/v1/social/friends/pending", headers=other_headers)
    user_a_id = pending_res.json()["incoming"][0]["user_id"]
    client.post(f"/api/v1/social/friends/accept/{user_a_id}", headers=other_headers)

    # 3. User B (other_headers, a friend) tries to GET -> 200
    get_b = client.get(f"/api/v1/photos/{photo_id}", headers=other_headers)
    assert get_b.status_code == 200
    assert get_b.json()["title"] == "Shared with friends"


def test_like_and_comment_actions(client, auth_headers, other_user, other_headers, third_headers):
    # A uploads a public photo
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Public Sunset", "privacy_level": "public"},
        files={"file": ("sunset.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = up_res.json()["id"]

    # 1. B likes A's photo
    like_res = client.post(f"/api/v1/social/photos/{photo_id}/like", headers=other_headers)
    assert like_res.status_code == 200
    assert like_res.json()["likes_count"] == 1
    assert like_res.json()["is_liked"] is True

    # 2. B unlikes
    unlike_res = client.post(f"/api/v1/social/photos/{photo_id}/like", headers=other_headers)
    assert unlike_res.status_code == 200
    assert unlike_res.json()["likes_count"] == 0
    assert unlike_res.json()["is_liked"] is False

    # 3. B comments on A's photo
    comment_res = client.post(
        f"/api/v1/social/photos/{photo_id}/comments",
        headers=other_headers,
        json={"text": "Awesome capture!"},
    )
    assert comment_res.status_code == 200
    comment_id = comment_res.json()["id"]

    # Get photo detail - verify comments_count and likes_count (which is 0)
    detail_res = client.get(f"/api/v1/photos/{photo_id}", headers=auth_headers)
    assert detail_res.json()["comments_count"] == 1
    assert detail_res.json()["likes_count"] == 0

    # 4. C tries to delete B's comment -> 403
    del_c = client.delete(f"/api/v1/social/comments/{comment_id}", headers=third_headers)
    assert del_c.status_code == 403

    # 5. A (photo owner) deletes B's comment -> 204
    del_a = client.delete(f"/api/v1/social/comments/{comment_id}", headers=auth_headers)
    assert del_a.status_code == 204
