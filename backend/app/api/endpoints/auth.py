import uuid as uuid_mod
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    create_password_reset_token,
)
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    UserOut,
    UserLogin,
    Token,
    TokenRefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from jose import jwt
from pydantic import ValidationError

router = APIRouter()

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if email exists
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system.",
        )
    
    # Check if username exists
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this username already exists in the system.",
        )
    
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    # Find user by username or email
    user = (
        db.query(User)
        .filter(
            (User.email == login_in.username_or_email)
            | (User.username == login_in.username_or_email)
        )
        .first()
    )
    
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username/email or password",
        )
        
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
def refresh_token(refresh_in: TokenRefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(refresh_in.refresh_token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type",
            )
        user_id_str = payload.get("sub")
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate refresh token",
        )

    try:
        user_id = uuid_mod.UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate refresh token",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
        
    access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.post("/forgot-password")
def forgot_password(forgot_in: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == forgot_in.email).first()
    if not user:
        return {"message": "If the email exists, a password reset link has been generated."}

    token = create_password_reset_token(forgot_in.email)
    
    # Printed to stdout for local/dev use
    reset_link = f"http://localhost:5173/reset-password?token={token}"
    print(f"\n[PASSWORD RESET LINK]: {reset_link}\n", flush=True)

    return {
        "message": "If the email exists, a password reset link has been generated.",
        "reset_token_dev": token
    }


@router.post("/reset-password")
def reset_password(reset_in: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(reset_in.token)
        token_type = payload.get("type")
        if token_type != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type",
            )
        email = payload.get("sub")
    except (jwt.JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid or has expired.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    user.hashed_password = get_password_hash(reset_in.password)
    db.add(user)
    db.commit()

    return {"message": "Password updated successfully!"}


