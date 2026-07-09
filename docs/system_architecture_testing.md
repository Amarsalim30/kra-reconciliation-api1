# System Architecture, Exception Handling & Testing

This document details the system design, error management strategy, database schemas, and testing practices utilized in the KRA Reconciliation API.

---

## 1. System Architecture

```
                       ┌───────────────────────┐
                       │  FastAPI (main.py)    │
                       └───────────┬───────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  V1 Router            │
                       │  (api/v1/router.py)   │
                       └───────────┬───────────┘
                                   │
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
      ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
      │  Auth API   │       │  Sales API  │       │Purchases API│
      └─────────────┘       └─────────────┘       └─────────────┘
```

### lifespan Event Management
The FastAPI application implements standard lifespan handlers (`app/main.py`) to manage setup and teardown:
* **Startup**: Initializes the database engine connection pool, instantiates the Service Layer client session, and spins up the background session cleanup task (which sweeps expired Redis sessions).
* **Shutdown**: Gracefully releases database connections, terminates active HTTPX client pools, and stops the background session cleaner.

---

## 2. Global Exception Handling

Custom domain exceptions are created in `app/core/exceptions.py` and handled globally using FastAPI exception handlers. This ensures that the API returns standardized, clean error payloads rather than revealing internal system stack traces.

### Standard Error Payload
All exception handlers format errors into a uniform schema:
```json
{
  "detail": "Error description message",
  "code": "ERROR_CODE"
}
```

### Registered Exception Mappings

| Exception Class | HTTP Status | Error Code | Reason |
| :--- | :--- | :--- | :--- |
| `SAPConnectionError` | 503 | `SAP_CONNECTION_FAILED` | Cannot reach SAP B1 Service Layer |
| `SAPQueryError` | 400 | `SAP_QUERY_EXECUTION_FAILED` | SAP SQL Query execution error |
| `SessionNotFound` | 404 | `SESSION_NOT_FOUND` | Provided session ID does not exist in Redis |
| `SessionExpired` | 410 | `SESSION_EXPIRED` | Redis session has expired past the 30min TTL |
| `CSVValidationError` | 422 | `CSV_VALIDATION_FAILED` | CSV header mismatch or value conversion errors |

---

## 3. Database Reference Schemas

The database uses PostgreSQL (configured via SQLAlchemy 2.0).

```
   ┌──────────────────────────┐             ┌──────────────────────────┐
   │          users           │             │      refresh_tokens      │
   ├──────────────────────────┤             ├──────────────────────────┤
   │ PK  id           INT     │◀───────────┐│ PK  id           INT     │
   │ UK  username     VARCHAR │            └│ FK  user_id      INT     │
   │     email        VARCHAR │             │ UK  token_hash   VARCHAR │
   │     password_hash VARCHAR│             │     created_at   DATETIME│
   │     role         VARCHAR │             │     expires_at   DATETIME│
   │     is_active    BOOLEAN │             │     revoked_at   DATETIME│
   │     created_at   DATETIME│             └──────────────────────────┘
   │     updated_at   DATETIME│
   └──────────────────────────┘
```

---

## 4. Testing & CI Pipeline

### Local Testing
Automated tests are located in the `tests/` directory and run using `pytest`.
* **Testing Database**: To isolate tests, the test suite overrides database dependencies to target a local, ephemeral SQLite database.
* **Test Command**:
  ```bash
  uv run python -m pytest tests/
  ```

### GitHub Actions CI/CD Pipeline
Every push or pull request triggers a multi-stage GitHub Actions workflow:
1. **Linting & Formatting**: Checks code quality using `ruff` and type consistency using `mypy`.
2. **Automated Testing**: Spins up a PostgreSQL test database container, runs database migrations, and executes pytest tests to ensure 100% test passing rate.
3. **Build Validation**: Verifies that the Docker image builds successfully.
