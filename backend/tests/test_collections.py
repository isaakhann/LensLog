import pytest

def test_create_collection_success(client, auth_headers):
    response = client.post(
        "/api/v1/collections/",
        headers=auth_headers,
        json={
            "name": "Summer Trip 2026",
            "description": "Photos from my trip to Greece",
            "is_public": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Summer Trip 2026"
    assert data["description"] == "Greece" or "trip to Greece" in data["description"]
    assert data["is_public"] is True

def test_list_collections(client, auth_headers):
    import time
    client.post(
        "/api/v1/collections/",
        headers=auth_headers,
        json={"name": "Album A"},
    )
    time.sleep(1.05)
    client.post(
        "/api/v1/collections/",
        headers=auth_headers,
        json={"name": "Album B"},
    )

    response = client.get("/api/v1/collections/", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Album B" # Sorted desc by created_at

def test_add_photo_to_collection(client, auth_headers):
    from tests.test_photos import _create_test_image
    
    # 1. Create collection
    col_res = client.post(
        "/api/v1/collections/",
        headers=auth_headers,
        json={"name": "Greek Sunset"},
    )
    col_id = col_res.json()["id"]

    # 2. Upload photo
    img_bytes = _create_test_image()
    photo_res = client.post(
        "/api/v1/photos/",
        headers=auth_headers,
        data={"title": "Oia Sunset"},
        files={"file": ("oia.jpg", img_bytes, "image/jpeg")},
    )
    photo_id = photo_res.json()["id"]

    # 3. Add to collection
    add_res = client.post(
        f"/api/v1/collections/{col_id}/photos/{photo_id}",
        headers=auth_headers,
    )
    assert add_res.status_code == 200
    assert add_res.json()["status"] == "success"

    # 4. Get collection and verify photo is inside
    get_res = client.get(f"/api/v1/collections/{col_id}", headers=auth_headers)
    assert get_res.status_code == 200
    photos = get_res.json()["photos"]
    assert len(photos) == 1
    assert photos[0]["title"] == "Oia Sunset"

    # 5. Remove photo
    rem_res = client.delete(
        f"/api/v1/collections/{col_id}/photos/{photo_id}",
        headers=auth_headers,
    )
    assert rem_res.status_code == 200

    # 6. Verify empty again
    get_res_2 = client.get(f"/api/v1/collections/{col_id}", headers=auth_headers)
    assert len(get_res_2.json()["photos"]) == 0
