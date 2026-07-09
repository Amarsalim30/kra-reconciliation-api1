from datetime import datetime

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=1, description="Username")
    password: str = Field(min_length=8, description="Password, minimum 8 characters")
    role: str = Field(default="checker", description="User role")


class UserLogin(BaseModel):
    username: str = Field(description="Username")
    password: str = Field(description="Password")


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str | None = None
