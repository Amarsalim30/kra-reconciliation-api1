from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_refresh_token
from app.models.refresh_token import RefreshToken


def create_refresh_token(db: Session, user_id: int) -> RefreshToken:
    settings = get_settings()
    token_str = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    token = RefreshToken(
        user_id=user_id,
        token=token_str,
        expires_at=expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def get_valid_token(db: Session, token_str: str) -> RefreshToken | None:
    now = datetime.now(timezone.utc)
    token = (
        db.query(RefreshToken)
        .filter(
            RefreshToken.token == token_str,
            RefreshToken.expires_at > now,
            RefreshToken.revoked_at.is_(None),
        )
        .first()
    )
    return token


def revoke_token(db: Session, token_str: str) -> None:
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(RefreshToken.token == token_str).update(
        {"revoked_at": now}
    )
    db.commit()


def revoke_all_user_tokens(db: Session, user_id: int) -> None:
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now})
    db.commit()
