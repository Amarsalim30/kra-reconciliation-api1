from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, generate_opaque_token, hash_token
from app.models.refresh_token import RefreshToken
from app.models.user import User


def create_refresh_token(db: Session, user_id: int) -> str:
    settings = get_settings()
    raw_token = generate_opaque_token()
    token_hash = hash_token(raw_token)
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    
    db_token = RefreshToken(
        token_hash=token_hash,
        user_id=user_id,
        created_at=now,
        expires_at=expires_at,
        revoked_at=None,
    )
    db.add(db_token)
    db.commit()
    return raw_token


def verify_refresh_token(db: Session, token: str) -> RefreshToken | None:
    token_hash = hash_token(token)
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    
    if db_token is None:
        return None
        
    now = datetime.now(timezone.utc)
    # Ensure expires_at and now are both offset-aware or naive.
    # Postgres columns with timezone=True are offset-aware datetime in python.
    # If db_token.expires_at is naive, we can compare it with datetime.now(timezone.utc).
    expires_at = db_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if db_token.revoked_at is not None or expires_at < now:
        return None
        
    return db_token


def rotate_refresh_token(db: Session, refresh_token: str) -> tuple[str, str] | None:
    db_token = verify_refresh_token(db, refresh_token)
    if db_token is None:
        return None
        
    # Revoke old token
    db_token.revoked_at = datetime.now(timezone.utc)
    
    # Get user
    user = db.query(User).filter(User.id == db_token.user_id).first()
    if user is None or not user.is_active:
        db.commit()
        return None
        
    # Create new tokens
    new_access_token = create_access_token(data={"sub": user.username})
    new_refresh_token = create_refresh_token(db, user.id)
    
    db.commit()
    return new_access_token, new_refresh_token


def revoke_refresh_token(db: Session, refresh_token: str) -> bool:
    token_hash = hash_token(refresh_token)
    db_token = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if db_token and db_token.revoked_at is None:
        db_token.revoked_at = datetime.now(timezone.utc)
        db.commit()
        return True
    return False
