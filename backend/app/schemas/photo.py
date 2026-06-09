from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class PhotoBase(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    personal_notes: Optional[str] = None
    privacy_level: str = Field(default="private", pattern="^(private|shared|public)$")
    mood: Optional[str] = None
    is_favorite: bool = False


class PhotoCreate(PhotoBase):
    """Fields sent alongside file upload (as form fields)."""
    tags: Optional[List[str]] = None


class PhotoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    personal_notes: Optional[str] = None
    privacy_level: Optional[str] = Field(None, pattern="^(private|shared|public)$")
    mood: Optional[str] = None
    is_favorite: Optional[bool] = None
    tags: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None


class PhotoOut(PhotoBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    url: str
    storage_key: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    city: Optional[str] = None
    country: Optional[str] = None
    capture_date: Optional[datetime] = None
    camera_model: Optional[str] = None
    lens_model: Optional[str] = None
    iso: Optional[int] = None
    aperture: Optional[str] = None
    shutter_speed: Optional[str] = None
    created_at: datetime
    tags: List[str] = []
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False

    @classmethod
    def from_orm_with_tags(
        cls,
        photo,
        likes_count: int = 0,
        comments_count: int = 0,
        is_liked: bool = False
    ) -> "PhotoOut":
        """Custom constructor that flattens Tag objects to string names."""
        tag_names = [t.name for t in photo.tags] if photo.tags else []
        data = {
            "id": photo.id,
            "user_id": photo.user_id,
            "title": photo.title,
            "description": photo.description,
            "personal_notes": photo.personal_notes,
            "privacy_level": photo.privacy_level,
            "mood": photo.mood,
            "is_favorite": photo.is_favorite,
            "url": photo.url,
            "storage_key": photo.storage_key,
            "latitude": photo.latitude,
            "longitude": photo.longitude,
            "city": photo.city,
            "country": photo.country,
            "capture_date": photo.capture_date,
            "camera_model": photo.camera_model,
            "lens_model": photo.lens_model,
            "iso": photo.iso,
            "aperture": photo.aperture,
            "shutter_speed": photo.shutter_speed,
            "created_at": photo.created_at,
            "tags": tag_names,
            "likes_count": likes_count,
            "comments_count": comments_count,
            "is_liked": is_liked,
        }
        return cls(**data)


class PhotoListOut(BaseModel):
    photos: List[PhotoOut]
    total: int
    page: int
    page_size: int
