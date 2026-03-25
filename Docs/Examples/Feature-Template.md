# [Feature Name]

**Status:** 🏗️ In Development / ✅ Production / 🔴 Critical / 🧪 Experimental
**Author:** [Your Name/Team]
**Date:** YYYY-MM-DD
**Version:** X.Y.Z
**Last Updated:** YYYY-MM-DD

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Design Philosophy](#design-philosophy)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)
8. [Implementation Guide](#implementation-guide)
9. [Testing](#testing)
10. [Performance](#performance)
11. [Troubleshooting](#troubleshooting)
12. [References](#references)

---

## Overview

**Purpose:** Brief 1-2 sentence description of what this feature does.

**Problem it solves:** What pain point or requirement does this address?

**Key benefits:**
- ✅ Benefit 1
- ✅ Benefit 2
- ✅ Benefit 3

**Use cases:**
- Use case 1
- Use case 2

---

## Design Philosophy

**Core principles guiding this implementation:**

### 1. [Principle Name]
Description of the principle and why it matters.

**Example:**
```
Principle: Server Independence
Why: The market data pipeline runs 24/7 whether clients are connected or not.
Impact: Ensures continuous data ingestion even during UI downtime.
```

### 2. [Another Principle]
Description...

### Trade-offs considered:
- **Option A vs Option B:** Why we chose A
- **Performance vs Simplicity:** How we balanced these

---

## Architecture

### High-Level Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Component  │──────▶│  Component  │──────▶│  Component  │
│      A      │       │      B      │       │      C      │
└─────────────┘       └─────────────┘       └─────────────┘
```

### Data Flow

```
1. Input (Source A)
      ↓
2. Processing (Module B)
      ↓
3. Storage (Database C)
      ↓
4. Output (Destination D)
```

### Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| Service A | Does X | FastAPI + APScheduler |
| Service B | Does Y | Redis + Pub/Sub |
| Service C | Does Z | PostgreSQL + Raw SQL |

---

## Features

### ✅ Implemented

#### Feature 1: [Feature Name]
**Description:** What it does
**Status:** ✅ Complete
**Added:** YYYY-MM-DD

**Usage:**
```python
# Example code
await feature_one.do_something()
```

#### Feature 2: [Feature Name]
...

---

### 🔜 Planned

#### Feature 3: [Planned Feature]
**Description:** What it will do
**Status:** 🔜 Planned
**Target:** YYYY-MM-DD (optional)
**Priority:** High / Medium / Low

**Why we need it:**
- Reason 1
- Reason 2

**Blockers:**
- Blocker 1 (if any)

---

### 🚫 Out of Scope

#### Feature X
**Why not:** Explanation of why this won't be implemented

---

## Database Schema

### Tables

#### `table_name`

```sql
CREATE TABLE table_name (
    id SERIAL PRIMARY KEY,
    field1 VARCHAR(100) NOT NULL,
    field2 DECIMAL(12, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_table_field1 (field1)
);
```

**Purpose:** What this table stores

**Key fields:**
- `field1`: Description
- `field2`: Description

**Indexes:**
- `idx_table_field1`: Why this index exists

**Relationships:**
- Foreign key to `other_table.id`

---

### Data Model Diagram

```
users (1)────────(N) watchlists
  ↓
  └──(1)────────(N) data_sources
```

---

## API Reference

### REST Endpoints

#### GET `/api/v1/resource/{id}`

**Description:** Retrieve a specific resource

**Authentication:** Required (`CurrentUser`)

**Path Parameters:**
- `id` (integer): Resource ID

**Query Parameters:**
- `include` (string, optional): Comma-separated list of related resources

**Response:**
```json
{
    "id": 1,
    "name": "Example",
    "created_at": "2026-02-16T10:30:00Z"
}
```

**Errors:**
- `404 Not Found`: Resource doesn't exist
- `403 Forbidden`: Insufficient permissions

**Example:**
```python
import requests

response = requests.get(
    "http://localhost:8200/api/v1/resource/123",
    headers={"Authorization": "Bearer <token>"}
)
```

---

#### POST `/api/v1/resource`

**Description:** Create a new resource

**Request Body:**
```json
{
    "name": "New Resource",
    "type": "example"
}
```

**Response:** `201 Created`

---

### WebSocket Endpoints

#### WS `/ws/stream`

**Description:** Real-time data streaming

**Connection:**
```typescript
const ws = new WebSocket('ws://localhost:8200/ws/stream?symbols=AAPL,TSLA')
```

**Messages:**
```json
{
    "type": "update",
    "data": {...}
}
```

---

## Configuration

### Environment Variables

```bash
# .env file

# Feature-specific settings
FEATURE_ENABLED=true
FEATURE_API_KEY=your_key_here
FEATURE_INTERVAL_SECONDS=5

# Optional settings
FEATURE_MAX_RETRIES=3
FEATURE_TIMEOUT=10
```

### Settings Class

```python
# apps/api/core/config.py

class Settings(BaseSettings):
    FEATURE_ENABLED: bool = False
    FEATURE_API_KEY: str = ""
    FEATURE_INTERVAL_SECONDS: int = 5
```

### Runtime Configuration

Can be changed via Runtime Config API (see [docs/Architecture.md#runtime-configuration](./Architecture.md#runtime-configuration)):

```bash
# Update setting without restart
curl -X PUT http://localhost:8200/api/v1/settings/FEATURE_INTERVAL_SECONDS \
  -H "Content-Type: application/json" \
  -d '{"value": 10}'
```

---

## Implementation Guide

### Prerequisites

- Python 3.11+
- PostgreSQL 14+ (or SQLite for dev)
- Redis 7+ (optional)

### Installation

```bash
# 1. Install dependencies
uv sync

# 2. Run database migrations
# Migration 009 will be applied automatically on startup

# 3. Configure environment
cp .env.example .env
# Edit .env with your settings

# 4. Start Redis (if required)
docker run -d -p 6379:6379 redis

# 5. Start API server
uvicorn apps.api.main:app --reload
```

### Integration into Existing Project

**1. Add to FastAPI lifecycle:**

```python
# apps/api/main.py

from apps.api.services.my_feature import start_feature, stop_feature

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await start_feature()

    yield

    # Shutdown
    await stop_feature()
```

**2. Register endpoints:**

```python
# apps/api/routes/v1/__init__.py

from .endpoints import my_feature

api_router.include_router(
    my_feature.router,
    prefix="/my-feature",
    tags=["My Feature"]
)
```

---

## Testing

### Unit Tests

```bash
# Run all feature tests
pytest tests/services/test_my_feature.py -v

# Run specific test
pytest tests/services/test_my_feature.py::test_specific_function -v
```

### Integration Tests

```bash
# End-to-end test
pytest tests/integration/test_my_feature_e2e.py -v
```

### Manual Testing

```bash
# 1. Start server
uvicorn apps.api.main:app --reload

# 2. Test endpoint
curl http://localhost:8200/api/v1/my-feature/test

# 3. Check logs
tail -f logs/app.log | grep MyFeature
```

---

## Performance

### Expected Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Throughput** | 1000 req/s | Under normal load |
| **Latency (p50)** | 50ms | Median response time |
| **Latency (p99)** | 200ms | 99th percentile |
| **Memory usage** | 100MB | Steady state |

### Optimizations Applied

1. **Database indexing** - Indexes on frequently queried fields
2. **Connection pooling** - Reused DB connections
3. **Caching** - Redis cache for hot data (60s TTL)
4. **Batch operations** - Bulk inserts via `execute_many()`

### Benchmarks

```bash
# Load test with 1000 concurrent requests
locust -f tests/load/locustfile_my_feature.py --host=http://localhost:8200
```

---

## Troubleshooting

### Common Issues

#### Issue: Feature not starting

**Symptoms:** No logs from feature, endpoints return 404

**Cause:** Feature not integrated into lifecycle

**Solution:**
1. Check `apps/api/main.py` lifespan includes `start_feature()`
2. Verify `FEATURE_ENABLED=true` in `.env`
3. Check logs for initialization errors

---

#### Issue: Database connection errors

**Symptoms:** `DatabaseManager not initialized` error

**Cause:** Database URL misconfigured

**Solution:**
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# PostgreSQL format:
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/dbname

# SQLite format:
DATABASE_URL=sqlite+aiosqlite:///data/db/app.db
```

---

#### Issue: High memory usage

**Symptoms:** Memory grows over time, doesn't stabilize

**Cause:** Possible memory leak in background worker

**Solution:**
1. Check for unclosed connections (Redis, HTTP clients)
2. Review background task cleanup in shutdown hooks
3. Monitor with `memory_profiler`

---

## References

### Internal Documentation

- [Database Architecture](./api/DATABASE_ARCHITECTURE.md) - Hybrid DB patterns
- [AI Development Guide](./AI_DEVELOPMENT_GUIDE.md) - Coding standards
- [Architecture](./Architecture.md) - Tech stack overview

### External Resources

- [Library/Framework Docs](https://example.com)
- [API Provider Docs](https://example.com)
- [Related Blog Post](https://example.com)

### Related Features

- [Feature A](./FEATURE_A.md) - Integrates with this
- [Feature B](./FEATURE_B.md) - Uses similar patterns

---

## Changelog

### v1.1.0 (YYYY-MM-DD)
- Added Feature X
- Fixed Bug Y
- Improved performance by 30%

### v1.0.0 (YYYY-MM-DD)
- Initial release
- Core features implemented

---

**Maintainer:** [Name/Team]
**Support:** [Email/Slack Channel]
**Status:** ✅ Production-ready / 🏗️ Under active development
