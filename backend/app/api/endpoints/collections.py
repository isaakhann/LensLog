from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
import uuid as uuid_mod

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.collection import Collection
from app.models.photo import Photo
from app.schemas.collection import CollectionOut, CollectionCreate, CollectionUpdate
from app.schemas.photo import PhotoOut

router = APIRouter()


@router.post("/", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(
    collection_in: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new collection."""
    db_collection = Collection(
        name=collection_in.name,
        description=collection_in.description,
        is_public=collection_in.is_public,
        user_id=current_user.id,
    )
    db.add(db_collection)
    db.commit()
    db.refresh(db_collection)
    return db_collection


@router.get("/", response_model=List[CollectionOut])
def list_collections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List current user's collections."""
    collections = (
        db.query(Collection)
        .options(joinedload(Collection.photos))
        .filter(Collection.user_id == current_user.id)
        .order_by(Collection.created_at.desc(), Collection.id.desc())
        .all()
    )
    # Map photos tags
    for col in collections:
        for p in col.photos:
            p.tags = p.tags # Trigger tags load
    return collections


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get single collection."""
    try:
        cid = uuid_mod.UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Collection not found")

    collection = (
        db.query(Collection)
        .options(joinedload(Collection.photos))
        .filter(Collection.id == cid)
        .first()
    )

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.user_id != current_user.id and not collection.is_public:
        raise HTTPException(status_code=403, detail="Access denied")

    return collection


@router.put("/{collection_id}", response_model=CollectionOut)
def update_collection(
    collection_id: str,
    collection_in: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a collection."""
    try:
        cid = uuid_mod.UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Collection not found")

    collection = db.query(Collection).filter(Collection.id == cid).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = collection_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(collection, field, value)

    db.commit()
    db.refresh(collection)
    return collection


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a collection."""
    try:
        cid = uuid_mod.UUID(collection_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Collection not found")

    collection = db.query(Collection).filter(Collection.id == cid).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(collection)
    db.commit()


@router.post("/{collection_id}/photos/{photo_id}", status_code=status.HTTP_200_OK)
def add_photo_to_collection(
    collection_id: str,
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a photo to a collection."""
    try:
        cid = uuid_mod.UUID(collection_id)
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Collection or Photo not found")

    collection = db.query(Collection).filter(Collection.id == cid).first()
    photo = db.query(Photo).filter(Photo.id == pid).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if collection.user_id != current_user.id or photo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if photo not in collection.photos:
        collection.photos.append(photo)
        db.commit()

    return {"status": "success"}


@router.delete("/{collection_id}/photos/{photo_id}", status_code=status.HTTP_200_OK)
def remove_photo_from_collection(
    collection_id: str,
    photo_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a photo from a collection."""
    try:
        cid = uuid_mod.UUID(collection_id)
        pid = uuid_mod.UUID(photo_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Collection or Photo not found")

    collection = db.query(Collection).filter(Collection.id == cid).first()
    photo = db.query(Photo).filter(Photo.id == pid).first()

    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if collection.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if photo in collection.photos:
        collection.photos.remove(photo)
        db.commit()

    return {"status": "success"}
