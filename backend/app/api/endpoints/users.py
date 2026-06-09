from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/me", response_model=UserOut)
def read_user_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserOut)
def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_in.email:
        # Check if email is already taken by another user
        existing_email = db.query(User).filter(
            User.email == user_in.email, User.id != current_user.id
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered by another user",
            )
        current_user.email = user_in.email
        
    if user_in.username:
        # Check if username is already taken by another user
        existing_username = db.query(User).filter(
            User.username == user_in.username, User.id != current_user.id
        ).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken by another user",
            )
        current_user.username = user_in.username
        
    if user_in.password:
        current_user.hashed_password = get_password_hash(user_in.password)
        
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
