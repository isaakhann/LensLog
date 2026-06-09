"""Social interactions API router (friendships, likes, comments, user search)."""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.photo import Photo
from app.models.social import Like, Comment, Friendship
from app.schemas.social import (
    CommentCreate,
    CommentOut,
    LikeToggleOut,
    UserBasicOut,
    UserSearchOut,
    PendingRequestsOut,
)

router = APIRouter()


@router.get("/users/search", response_model=List[UserSearchOut])
def search_users(
    query: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for other users by username or email, exposing friendship status."""
    users = (
        db.query(User)
        .filter(
            and_(
                User.id != current_user.id,
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.email.ilike(f"%{query}%"),
                ),
            )
        )
        .limit(20)
        .all()
    )

    results = []
    for u in users:
        friendship = (
            db.query(Friendship)
            .filter(
                or_(
                    and_(Friendship.user_id == current_user.id, Friendship.friend_id == u.id),
                    and_(Friendship.user_id == u.id, Friendship.friend_id == current_user.id),
                )
            )
            .first()
        )

        status_str = "none"
        if friendship:
            if friendship.status == "accepted":
                status_str = "accepted"
            elif friendship.user_id == current_user.id:
                status_str = "pending_sent"
            else:
                status_str = "pending_received"

        results.append(
            UserSearchOut(
                id=u.id,
                username=u.username,
                email=u.email,
                profile_picture_url=u.profile_picture_url,
                friendship_status=status_str,
            )
        )
    return results


@router.post("/friends/request/{friend_id}", status_code=status.HTTP_201_CREATED)
def send_friend_request(
    friend_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a friend request to another user."""
    if friend_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself.",
        )

    target = db.query(User).filter(User.id == friend_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    existing = (
        db.query(Friendship)
        .filter(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == current_user.id),
            )
        )
        .first()
    )

    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already friends.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A friend request is already pending.",
            )

    new_request = Friendship(
        user_id=current_user.id,
        friend_id=friend_id,
        status="pending",
    )
    db.add(new_request)
    db.commit()
    return {"detail": "Friend request sent successfully."}


@router.post("/friends/accept/{sender_id}")
def accept_friend_request(
    sender_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept an incoming friend request."""
    request = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == sender_id,
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending friend request not found.",
        )

    request.status = "accepted"
    db.commit()
    return {"detail": "Friend request accepted."}


@router.post("/friends/decline/{user_id}")
def decline_friend_request(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a sent request, decline an incoming request, or unfriend an active friend."""
    friendship = (
        db.query(Friendship)
        .filter(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_id),
                and_(Friendship.user_id == user_id, Friendship.friend_id == current_user.id),
            )
        )
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship or request not found.",
        )

    db.delete(friendship)
    db.commit()
    return {"detail": "Friendship or request removed successfully."}


@router.get("/friends", response_model=List[UserBasicOut])
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all accepted friends."""
    friendships = (
        db.query(Friendship)
        .filter(
            and_(
                Friendship.status == "accepted",
                or_(
                    Friendship.user_id == current_user.id,
                    Friendship.friend_id == current_user.id,
                ),
            )
        )
        .options(joinedload(Friendship.user), joinedload(Friendship.friend))
        .all()
    )

    friends = []
    for f in friendships:
        if f.user_id == current_user.id:
            friends.append(f.friend)
        else:
            friends.append(f.user)
    return friends


@router.get("/friends/pending", response_model=PendingRequestsOut)
def list_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List incoming and outgoing pending requests."""
    incoming = (
        db.query(Friendship)
        .filter(
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
        .options(joinedload(Friendship.user), joinedload(Friendship.friend))
        .all()
    )

    outgoing = (
        db.query(Friendship)
        .filter(
            Friendship.user_id == current_user.id,
            Friendship.status == "pending",
        )
        .options(joinedload(Friendship.user), joinedload(Friendship.friend))
        .all()
    )

    return PendingRequestsOut(incoming=incoming, outgoing=outgoing)


@router.post("/photos/{photo_id}/like", response_model=LikeToggleOut)
def toggle_like(
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a like on a photo (owners and friends/public visitors can like)."""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found.",
        )

    # Access control check
    if photo.user_id != current_user.id and photo.privacy_level == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if photo.user_id != current_user.id and photo.privacy_level == "shared":
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

    like = (
        db.query(Like)
        .filter(Like.user_id == current_user.id, Like.photo_id == photo_id)
        .first()
    )

    if like:
        db.delete(like)
        is_liked = False
    else:
        new_like = Like(user_id=current_user.id, photo_id=photo_id)
        db.add(new_like)
        is_liked = True

    db.commit()

    likes_count = db.query(Like).filter(Like.photo_id == photo_id).count()
    return LikeToggleOut(likes_count=likes_count, is_liked=is_liked)


@router.get("/photos/{photo_id}/likes", response_model=List[UserBasicOut])
def get_photo_likes(
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the list of profiles that liked this photo."""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found.",
        )

    # Access check
    if photo.user_id != current_user.id and photo.privacy_level == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if photo.user_id != current_user.id and photo.privacy_level == "shared":
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

    likes = (
        db.query(Like)
        .filter(Like.photo_id == photo_id)
        .options(joinedload(Like.user))
        .all()
    )
    return [l.user for l in likes]


@router.post("/photos/{photo_id}/comments", response_model=CommentOut)
def add_comment(
    photo_id: UUID,
    comment_in: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Post a comment to a photo."""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found.",
        )

    # Access check
    if photo.user_id != current_user.id and photo.privacy_level == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if photo.user_id != current_user.id and photo.privacy_level == "shared":
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

    new_comment = Comment(
        user_id=current_user.id,
        photo_id=photo_id,
        text=comment_in.text,
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    # Reload comment with user relationship eagerly loaded
    comment_db = (
        db.query(Comment)
        .filter(Comment.id == new_comment.id)
        .options(joinedload(Comment.user))
        .first()
    )
    return comment_db


@router.get("/photos/{photo_id}/comments", response_model=List[CommentOut])
def get_photo_comments(
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all comments on a photo chronologically."""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found.",
        )

    # Access check
    if photo.user_id != current_user.id and photo.privacy_level == "private":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )
    if photo.user_id != current_user.id and photo.privacy_level == "shared":
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
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied.",
            )

    comments = (
        db.query(Comment)
        .filter(Comment.photo_id == photo_id)
        .options(joinedload(Comment.user))
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a comment (only commenter or photo owner can delete)."""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comment not found.",
        )

    photo = db.query(Photo).filter(Photo.id == comment.photo_id).first()

    if comment.user_id != current_user.id and (not photo or photo.user_id != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this comment.",
        )

    db.delete(comment)
    db.commit()
