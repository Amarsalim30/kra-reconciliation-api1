# Authentication Module Documentation

The KRA Reconciliation API utilizes a secure, state-of-the-art authentication system based on JWT access tokens and database-backed opaque refresh tokens with rotation and revocation.

---

## Architecture Overview

1. **Access Tokens**: Short-lived JSON Web Tokens (JWT) signed with `HS256`. By default, they expire after **30 minutes** (configured via `ACCESS_TOKEN_EXPIRE_MINUTES`).
2. **Refresh Tokens**: Long-lived opaque tokens stored securely as SHA-256 hashes in the `refresh_tokens` database table. By default, they expire after **7 days** (configured via `REFRESH_TOKEN_EXPIRE_DAYS`).
3. **Token Rotation**: Each time a client requests a new access token via `/api/v1/auth/refresh`, the old refresh token is marked as revoked, and a new access token + a new refresh token are generated and returned. This guarantees protection against refresh token theft.
4. **Logout**: When logging out, the client sends their active refresh token, which is marked as revoked in the database to prevent any future use.

---

## API Endpoints Reference

All authentication endpoints are versioned under the `/api/v1/auth` prefix.

| Method | Endpoint | Request Content-Type | Request Body | Response Model | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/register` | `application/json` | `UserCreate` | `UserResponse` | Creates a new user account (defaults to the "checker" role). |
| **POST** | `/api/v1/auth/login` | `application/json` | `UserLogin` | `TokenResponse` | Authenticates a user and returns an access + refresh token pair. Standard JSON endpoint. |
| **POST** | `/api/v1/auth/token` | `application/x-www-form-urlencoded` | `username`, `password` _(Form)_ | `TokenResponse` | Standard OAuth2-compliant token endpoint (used by Swagger UI "Authorize" lock). |
| **POST** | `/api/v1/auth/refresh` | `application/json` | `RefreshRequest` | `TokenResponse` | Refreshes the short-lived access token by rotating the refresh token. |
| **POST** | `/api/v1/auth/logout` | `application/json` | `LogoutRequest` | `{"detail": "..."}` | Revokes the provided refresh token, logging the user out. |
| **GET** | `/api/v1/auth/me` | None (Requires Bearer Token) | None | `UserResponse` | Returns the current logged-in user profile. |

### Schemas Reference

#### `UserCreate` (JSON)
```json
{
  "username": "username123",
  "password": "securepassword",
  "email": "user@example.com",
  "role": "checker"
}
```

#### `UserResponse` (JSON)
```json
{
  "id": 1,
  "username": "username123",
  "email": "user@example.com",
  "role": "checker",
  "is_active": true,
  "created_at": "2026-07-10T01:56:15Z",
  "updated_at": "2026-07-10T01:56:15Z"
}
```

#### `TokenResponse` (JSON)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "q_WbI-PbrvY5hEc_tSn4...",
  "token_type": "bearer"
}
```

---

## Interactive testing via Swagger UI

The login endpoint has been built to support both standard JSON client requests and standard form-encoded requests, making it fully compatible with FastAPI's automatic documentation interactive features.

1. Run the server locally:
   ```bash
   uv run uvicorn app.main:app --reload
   ```
2. Navigate to [http://localhost:8000/docs](http://localhost:8000/docs) in your web browser.
3. Use the **Authorize** lock button in the upper-right corner of the page:
   * Enter your credentials (username/password).
   * Click **Authorize**. The browser will send a form-encoded login request and save the resulting access token.
4. Once authorized, you can interactively test the protected `/api/v1/auth/me` route.
