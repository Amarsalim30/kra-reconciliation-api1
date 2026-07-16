from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserPasswordReset, UserResponse, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


def _resolve_list_scope(
    current_user: User = Depends(get_current_user),
    company_id: Optional[int] = Query(None, description="Filter by company (platform admin only)"),
) -> Optional[int]:
    """Platform admins may list any company's users or all users; company users
    are restricted to their own company and ignore the filter."""
    if current_user.company_id is None:
        return company_id
    return current_user.company_id


@router.get("", response_model=List[UserResponse])
def list_users(
    scope_company_id: Optional[int] = Depends(_resolve_list_scope),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """List users. Platform admins see all (optionally filtered); company users see their company only."""
    return user_service.list_users(db, company_id=scope_company_id)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new user.

    - Platform admins (company_id is None) can create users for any company or global admins.
    - Company admins can create users for their assigned company only.
    """
    if current_user.company_id is not None:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can manage users.",
            )
        # Enforce target user company scope to match current company admin scope
        body.company_id = current_user.company_id

    existing = user_service.get_by_username(db, body.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists.",
        )
    return user_service.create_user(db, body)


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a user. Platform admins can update any user; company admins can update users in their company."""
    target_user = user_service.get_by_id(db, user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if current_user.company_id is not None:
        if current_user.role != "admin" or target_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage users within your company.",
            )
        if body.company_id is not None and body.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign user to a different company.",
            )

    if body.is_active is False and user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    try:
        updated = user_service.update_user(db, user_id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return updated


@router.post("/{user_id}/reset-password", response_model=UserResponse)
def reset_password(
    user_id: int,
    body: UserPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reset a user's password. Accessible by platform admins or company admins for users in their company."""
    target_user = user_service.get_by_id(db, user_id)
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if current_user.company_id is not None:
        if current_user.role != "admin" or target_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only reset passwords for users within your company.",
            )

    updated = user_service.reset_password(db, user_id, body.new_password)
    return updated
