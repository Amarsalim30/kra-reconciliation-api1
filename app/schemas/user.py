from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=1, description="Username")
    password: str = Field(min_length=8, description="Password, minimum 8 characters")
    email: str | None = Field(default=None, description="Email address")
    full_name: str | None = Field(default=None, description="Display name")
    role: str = Field(default="checker", description="User role: admin, checker, or viewer")


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserPasswordReset(BaseModel):
    new_password: str = Field(min_length=8, description="New password, minimum 8 characters")


class UserLogin(BaseModel):
    username: str = Field(description="Username")
    password: str = Field(description="Password")


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: str
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str
