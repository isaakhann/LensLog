from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class UserBasicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    profile_picture_url: Optional[str] = None

class CommentCreate(BaseModel):
    text: str

class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    photo_id: UUID
    text: str
    created_at: datetime
    user: UserBasicOut

class LikeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_id: UUID
    photo_id: UUID
    created_at: datetime
    user: UserBasicOut

class UserSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    username: str
    email: str
    profile_picture_url: Optional[str] = None
    friendship_status: str  # "none" | "pending_sent" | "pending_received" | "accepted"

class FriendRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: UUID
    friend_id: UUID
    status: str
    created_at: datetime
    user: UserBasicOut  # The sender
    friend: UserBasicOut # The recipient

class PendingRequestsOut(BaseModel):
    incoming: List[FriendRequestOut]
    outgoing: List[FriendRequestOut]

class LikeToggleOut(BaseModel):
    likes_count: int
    is_liked: bool

