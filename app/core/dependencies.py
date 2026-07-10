from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.database import get_db
from app.models.user import User
from app.core.sap_client import SAPClient

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def get_sap_client(request: Request = None) -> SAPClient:
    """
    Dependency to retrieve the SAPClient instance.
    Uses app.state if running in the FastAPI app context, otherwise falls back to request-scoped instance.
    """
    if request and hasattr(request.app.state, "sap_client"):
        return request.app.state.sap_client
    # Fallback for testing or scripts
    if not hasattr(get_sap_client, "_fallback_client"):
        get_sap_client._fallback_client = SAPClient()
    return get_sap_client._fallback_client



def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=[settings.algorithm],
        )
        username: str | None = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user


def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


def get_active_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> ReconciliationSession:
    from datetime import datetime, timedelta
    from app.models.reconciliation_session import ReconciliationSession

    session = db.query(ReconciliationSession).filter(
        ReconciliationSession.id == session_id,
        ReconciliationSession.user_id == current_user.id
    ).first()
    
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reconciliation session not found."
        )
        
    # Check if expired (> 30 min idle)
    # Using naive datetime to match model default
    expiry_time = datetime.utcnow() - timedelta(minutes=30)
    if session.last_accessed_at.replace(tzinfo=None) < expiry_time:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has expired. Please start a new load request."
        )
        
    # Update last accessed time
    session.last_accessed_at = datetime.utcnow()
    db.commit()
    return session
