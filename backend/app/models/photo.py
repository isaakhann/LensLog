import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

# Many-to-Many junction table for Photos and Tags
photo_tags = Table(
    "photo_tags",
    Base.metadata,
    Column(
        "photo_id",
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        primary_key=True
    ),
    Column(
        "tag_id",
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True
    )
)

class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

    # Relationships
    photos = relationship("Photo", secondary=photo_tags, back_populates="tags")

class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=True)
    description = Column(String, nullable=True)
    personal_notes = Column(String, nullable=True)

    storage_key = Column(String, nullable=False)
    url = Column(String, nullable=False)
    privacy_level = Column(String, default="private", nullable=False)  # "private" | "shared" | "public"

    # Geolocation
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    city = Column(String, nullable=True)
    country = Column(String, nullable=True)

    # EXIF Data
    capture_date = Column(DateTime(timezone=True), nullable=True)
    camera_model = Column(String, nullable=True)
    lens_model = Column(String, nullable=True)
    iso = Column(Integer, nullable=True)
    aperture = Column(String, nullable=True)
    shutter_speed = Column(String, nullable=True)

    is_favorite = Column(Boolean, default=False, nullable=False)
    mood = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
    tags = relationship("Tag", secondary=photo_tags, back_populates="photos")
