from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, verify_password
from app.database.database import get_db
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.schemas.company import CompanyCreate
from app.services import auth_service, user_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(db: Session, username: str, password: str) -> TokenResponse:
    user = user_service.authenticate_user(db, username, password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    access_token = create_access_token(data={"sub": user.username})
    refresh_token = auth_service.create_refresh_token(db, user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)):
    return _issue_tokens(db, body.username, body.password)


@router.post("/token", response_model=TokenResponse)
def token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    return _issue_tokens(db, form_data.username, form_data.password)



@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(body: UserCreate, db: Session = Depends(get_db)):
    existing = user_service.get_by_username(db, body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    # Self-serve onboarding: a registering user must belong to a company. If no
    # company is supplied, associate them with the first existing company, or
    # create a default one. This keeps every user company-scoped for SaaS isolation.
    company_id = body.company_id
    if company_id is None:
        from app.models.company import Company
        from app.services import company_service

        company = db.query(Company).order_by(Company.id.asc()).first()
        if company is None:
            company = company_service.create_company(
                db, CompanyCreate(name="Default Company")
            )
        company_id = company.id

    user = user_service.create_user(db, UserCreate(**{**body.model_dump(), "company_id": company_id}))
    return user


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    tokens = auth_service.rotate_refresh_token(db, body.refresh_token)
    if tokens is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    access_token, refresh_token = tokens
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    revoked = auth_service.revoke_refresh_token(db, body.refresh_token)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already revoked refresh token",
        )
    return {"detail": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=UserResponse)
def change_password(
    body: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    updated = user_service.reset_password(db, current_user.id, body.new_password)
    return updated
