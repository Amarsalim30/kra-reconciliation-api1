from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.database.database import get_db
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.services import user_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = user_service.authenticate_user(db, body.username, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    access_token = create_access_token(data={"sub": user.username})
    return Token(access_token=access_token)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    existing = user_service.get_by_username(db, body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    user = user_service.create_user(db, body)
    return user


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
