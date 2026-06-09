import pytest
from io import BytesIO
from PIL import Image

def _create_test_image(exif_data=None) -> bytes:
    """Create in-memory image bytes with optional exif data for testing."""
    file = BytesIO()
    image = Image.new("RGB", (100, 100), color="red")
    
    # We can inject EXIF tags to verify exif parser.
    # For now, just generate a simple JPEG
    if exif_data is not None:
        image.save(file, format="JPEG", exif=exif_data)
    else:
        image.save(file, format="JPEG")
    file.seek(0)
    return file.read()

def test_upload_photo_success(client, auth_headers):
    # Create simple image bytes
    img_bytes = _create_test_image()
    
    response = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={
            "title": "Sunset Beach",
            "description": "Lovely beach sunset in Summer",
            "personal_notes": "Aperture priority mode",
            "privacy_level": "public",
            "mood": "happy",
            "tags": '["nature", "beach"]',
        },
        files={"file": ("sunset.jpg", img_bytes, "image/jpeg")},
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Sunset Beach"
    assert data["description"] == "Lovely beach sunset in Summer"
    assert data["privacy_level"] == "public"
    assert data["mood"] == "happy"
    assert "nature" in data["tags"]
    assert "beach" in data["tags"]
    assert data["url"].startswith("/static/uploads/photos/")

def test_upload_photo_invalid_type(client, auth_headers):
    response = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Doc"},
        files={"file": ("doc.txt", b"plain text content", "text/plain")},
    )
    assert response.status_code == 400
    assert "not supported" in response.json()["detail"]

def test_list_photos(client, auth_headers):
    # Upload two photos
    img_bytes = _create_test_image()
    
    import time
    client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Photo 1"},
        files={"file": ("img1.jpg", img_bytes, "image/jpeg")},
    )
    time.sleep(1.05)
    client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Photo 2"},
        files={"file": ("img2.jpg", img_bytes, "image/jpeg")},
    )
    
    response = client.get("/api/v1/photos/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["photos"]) == 2
    assert data["photos"][0]["title"] == "Photo 2" # Sorted desc by default

def test_get_photo_detail(client, auth_headers):
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Detailed Shot"},
        files={"file": ("details.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = up_res.json()["id"]
    
    response = client.get(f"/api/v1/photos/{photo_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Detailed Shot"

def test_update_photo_metadata(client, auth_headers):
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Original Title", "tags": '["old"]'},
        files={"file": ("photo.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = up_res.json()["id"]
    
    response = client.put(
        f"/api/v1/photos/{photo_id}",
        headers=auth_headers,
        json={
            "title": "Updated Title",
            "tags": ["new", "updated"],
            "privacy_level": "private",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert "new" in data["tags"]
    assert "old" not in data["tags"]
    assert data["privacy_level"] == "private"

def test_toggle_favorite(client, auth_headers):
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Fav Photo"},
        files={"file": ("fav.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = up_res.json()["id"]
    assert up_res.json()["is_favorite"] is False
    
    # Toggle on
    response = client.post(f"/api/v1/photos/{photo_id}/favorite", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_favorite"] is True
    
    # Toggle off
    response = client.post(f"/api/v1/photos/{photo_id}/favorite", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["is_favorite"] is False

def test_delete_photo(client, auth_headers):
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "To Delete"},
        files={"file": ("delete.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = up_res.json()["id"]
    
    # Delete
    response = client.delete(f"/api/v1/photos/{photo_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Verify 404 on get
    get_res = client.get(f"/api/v1/photos/{photo_id}", headers=auth_headers)
    assert get_res.status_code == 404

def test_list_public_photos(client, auth_headers):
    img_bytes = _create_test_image()
    
    # 1. Upload private photo
    client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Secret Photo", "privacy_level": "private"},
        files={"file": ("secret.jpg", img_bytes, "image/jpeg")},
    )

    # 2. Upload public photo
    client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Shared Photo", "privacy_level": "public"},
        files={"file": ("shared.jpg", img_bytes, "image/jpeg")},
    )

    # 3. Query public feed
    response = client.get("/api/v1/photos/public", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Secret photo should NOT be present in public feed
    assert data["total"] == 1
    assert data["photos"][0]["title"] == "Shared Photo"


def test_unauthorized_photo_actions(client, auth_headers, db):
    # 1. Upload photo as user A (using auth_headers)
    img_bytes = _create_test_image()
    up_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "User A Photo", "privacy_level": "public"},
        files={"file": ("photo.jpg", img_bytes, "image/jpeg")},
    )
    assert up_res.status_code == 201
    photo_id = up_res.json()["id"]

    # 2. Create and log in User B
    from app.core.security import get_password_hash
    from app.models.user import User
    
    password = "otherpassword123"
    hashed_pwd = get_password_hash(password)
    other_user = User(
        email="otheruser@example.com",
        username="otheruser",
        hashed_password=hashed_pwd,
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)
    
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": other_user.email,
            "password": password,
        },
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    other_headers = {"Authorization": f"Bearer {token_data['access_token']}"}

    # 3. Try to update user A's photo as user B -> expect 403
    update_res = client.put(
        f"/api/v1/photos/{photo_id}",
        headers=other_headers,
        json={"title": "Hacked Title"},
    )
    assert update_res.status_code == 403

    # 4. Try to delete user A's photo as user B -> expect 403
    delete_res = client.delete(
        f"/api/v1/photos/{photo_id}",
        headers=other_headers,
    )
    assert delete_res.status_code == 403

    # 5. Try to toggle favorite on user A's photo as user B -> expect 404 (since query looks for own photos)
    fav_res = client.post(
        f"/api/v1/photos/{photo_id}/favorite",
        headers=other_headers,
    )
    assert fav_res.status_code == 404


