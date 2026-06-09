"""Photo upload, CRUD, and listing API endpoints."""
import json
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.photo import Photo, Tag, photo_tags
from app.models.social import Like, Comment, Friendship
from app.schemas.photo import PhotoOut, PhotoUpdate, PhotoListOut
from app.services.storage import get_storage_provider
from app.services.exif import extract_exif

router = APIRouter()


def _get_or_create_tags(db: Session, tag_names: List[str]) -> List[Tag]:
    """Retrieve existing tags or create new ones."""
    tags = []
    for name in tag_names:
        name = name.strip().lower()
        if not name:
            continue
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def _make_photo_out(db: Session, photo: Photo, current_user_id: UUID) -> PhotoOut:
    """Helper to load social metadata (likes, comments, is_liked) and return PhotoOut."""
    likes_count = db.query(Like).filter(Like.photo_id == photo.id).count()
    comments_count = db.query(Comment).filter(Comment.photo_id == photo.id).count()
    is_liked = db.query(Like).filter(Like.photo_id == photo.id, Like.user_id == current_user_id).first() is not None
    return PhotoOut.from_orm_with_tags(
        photo,
        likes_count=likes_count,
        comments_count=comments_count,
        is_liked=is_liked
    )



@router.post("/", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    personal_notes: Optional[str] = Form(None),
    privacy_level: str = Form("private"),
    mood: Optional[str] = Form(None),
    is_favorite: bool = Form(False),
    tags: Optional[str] = Form(None),  # comma-separated or JSON array
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a single photo with optional metadata."""
    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/tiff"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{file.content_type}' is not supported. Use JPEG, PNG, WebP, HEIC, or TIFF.",
        )

    # Read file bytes for EXIF extraction
    file_bytes = await file.read()
    await file.seek(0)  # Reset for storage upload

    # Extract EXIF metadata
    exif_data = extract_exif(file_bytes)

    # Upload to storage provider
    storage = get_storage_provider()
    upload_result = storage.upload_file(file, folder="photos")

    # Parse tags
    tag_list = []
    if tags:
        try:
            tag_list = json.loads(tags)
        except json.JSONDecodeError:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    db_tags = _get_or_create_tags(db, tag_list)

    # Create photo record
    photo = Photo(
        user_id=current_user.id,
        title=title,
        description=description,
        personal_notes=personal_notes,
        privacy_level=privacy_level,
        mood=mood,
        is_favorite=is_favorite,
        url=upload_result["url"],
        storage_key=upload_result["storage_key"],
        latitude=exif_data.latitude,
        longitude=exif_data.longitude,
        capture_date=exif_data.capture_date,
        camera_model=exif_data.camera_model,
        lens_model=exif_data.lens_model,
        iso=exif_data.iso,
        aperture=exif_data.aperture,
        shutter_speed=exif_data.shutter_speed,
    )
    photo.tags = db_tags

    db.add(photo)
    db.commit()
    db.refresh(photo)

    return _make_photo_out(db, photo, current_user.id)


@router.get("/", response_model=PhotoListOut)
def list_my_photos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List the current user's photos with pagination."""
    query = (
        db.query(Photo)
        .options(joinedload(Photo.tags))
        .filter(Photo.user_id == current_user.id)
        .order_by(Photo.created_at.desc(), Photo.id.desc())
    )

    total = query.count()
    photos = query.offset((page - 1) * page_size).limit(page_size).all()

    # Deduplicate due to joinedload
    seen = set()
    unique_photos = []
    for p in photos:
        if p.id not in seen:
            seen.add(p.id)
            unique_photos.append(p)

    return PhotoListOut(
        photos=[_make_photo_out(db, p, current_user.id) for p in unique_photos],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/public", response_model=PhotoListOut)
def list_public_photos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all public photos in the system, and friend-shared photos, with pagination."""
    # Find active friends
    friend_ids_1 = db.query(Friendship.friend_id).filter(
        Friendship.user_id == current_user.id, Friendship.status == "accepted"
    )
    friend_ids_2 = db.query(Friendship.user_id).filter(
        Friendship.friend_id == current_user.id, Friendship.status == "accepted"
    )
    friend_ids = [fid[0] for fid in friend_ids_1.all()] + [fid[0] for fid in friend_ids_2.all()]

    query = (
        db.query(Photo)
        .options(joinedload(Photo.tags))
        .filter(
            or_(
                Photo.privacy_level == "public",
                and_(Photo.privacy_level == "shared", Photo.user_id.in_(friend_ids))
            )
        )
        .order_by(Photo.created_at.desc(), Photo.id.desc())
    )

    total = query.count()
    photos = query.offset((page - 1) * page_size).limit(page_size).all()

    # Deduplicate due to joinedload
    seen = set()
    unique_photos = []
    for p in photos:
        if p.id not in seen:
            seen.add(p.id)
            unique_photos.append(p)

    return PhotoListOut(
        photos=[_make_photo_out(db, p, current_user.id) for p in unique_photos],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{photo_id}", response_model=PhotoOut)
def get_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single photo by ID (owner or public/shared access)."""
    import uuid as uuid_mod

    try:
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = (
        db.query(Photo)
        .options(joinedload(Photo.tags))
        .filter(Photo.id == pid)
        .first()
    )

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Access control
    if photo.user_id != current_user.id:
        if photo.privacy_level == "private":
            raise HTTPException(status_code=403, detail="Access denied")
        elif photo.privacy_level == "shared":
            # Check friendship
            friendship = (
                db.query(Friendship)
                .filter(
                    Friendship.status == "accepted",
                    or_(
                        and_(Friendship.user_id == current_user.id, Friendship.friend_id == photo.user_id),
                        and_(Friendship.user_id == photo.user_id, Friendship.friend_id == current_user.id),
                    ),
                )
                .first()
            )
            if not friendship:
                raise HTTPException(status_code=403, detail="Access denied")

    return _make_photo_out(db, photo, current_user.id)


@router.put("/{photo_id}", response_model=PhotoOut)
def update_photo(
    photo_id: str,
    photo_in: PhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a photo's metadata (owner only)."""
    import uuid as uuid_mod

    try:
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = (
        db.query(Photo)
        .options(joinedload(Photo.tags))
        .filter(Photo.id == pid)
        .first()
    )

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this photo")

    update_data = photo_in.model_dump(exclude_unset=True)
    tags_data = update_data.pop("tags", None)

    for field, value in update_data.items():
        setattr(photo, field, value)

    if tags_data is not None:
        photo.tags = _get_or_create_tags(db, tags_data)

    db.add(photo)
    db.commit()
    db.refresh(photo)

    return _make_photo_out(db, photo, current_user.id)


@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a photo (owner only)."""
    import uuid as uuid_mod

    try:
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = db.query(Photo).filter(Photo.id == pid).first()

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this photo")

    # Delete from storage
    storage = get_storage_provider()
    storage.delete_file(photo.storage_key)

    db.delete(photo)
    db.commit()


@router.post("/{photo_id}/favorite", response_model=PhotoOut)
def toggle_favorite(
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle the favorite status of a photo."""
    import uuid as uuid_mod

    try:
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo = (
        db.query(Photo)
        .options(joinedload(Photo.tags))
        .filter(Photo.id == pid, Photo.user_id == current_user.id)
        .first()
    )

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.is_favorite = not photo.is_favorite
    db.commit()
    db.refresh(photo)

    return _make_photo_out(db, photo, current_user.id)
