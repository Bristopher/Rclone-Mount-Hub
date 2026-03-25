# AI Development Guide - OptionsMania

**Purpose:** Critical rules and patterns that ALL AI assistants must follow when working on this codebase.

**Status:** 📌 **MUST READ** before generating any code
**Last Updated:** 2026-02-23

---

## 🔴 Critical Rules - ALWAYS Follow

### 1. Database Access Patterns

**USE:**
```python
from apps.api.db.manager import Db, DbSession

# For performance-critical operations (market data, trading, time series):
async def endpoint(db: Db):
    p = db.param_placeholder
    await db.execute(f"INSERT INTO quotes VALUES ({p}, {p})", (symbol, price))
    rows = await db.fetch_dict_all(f"SELECT * FROM quotes WHERE symbol = {p}", (symbol,))
```

**For relationships and auth (User ↔ Sessions):**
```python
from apps.api.db.manager import DbSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def endpoint(db: DbSession):
    result = await db.execute(
        select(User).options(selectinload(User.sessions))
    )
```

**NEVER:**
- ❌ Use ORM for performance-critical operations
- ❌ String interpolation (`f"... WHERE id = {user_id}"`) - **SQL injection risk!**
- ❌ N+1 queries (use `selectinload()` with ORM)

**Reference:** [docs/api/DATABASE_ARCHITECTURE.md](./api/DATABASE_ARCHITECTURE.md)

---

### 2. Time Management - ALWAYS Use timekeeper.py

**CRITICAL:** Use `timekeeper.py` for ALL datetime operations. Never import Python's `datetime` module directly.

**USE:**
```python
from apps.api.utils.timekeeper import (
    now_utc,          # Get current UTC time (Instant)
    now_utc_py,       # For SQLAlchemy/Pydantic (Python datetime)
    to_db_timestamp,  # Convert to ISO string for DB
    from_db_timestamp,# Parse DB timestamp
    market_now,       # Current time in Eastern (market) timezone
    market_date_today,# Today's date in market timezone
    is_expired,       # Check if timestamp expired
    time_since,       # Calculate elapsed time
)

# CORRECT: Storing timestamp in database
timestamp = to_db_timestamp(now_utc())
await db.execute(f"INSERT INTO quotes (timestamp) VALUES ({p})", (timestamp,))

# CORRECT: Using market timezone for trading hours
market_time = market_now()
if market_time.time() >= time(9, 30):  # Market open
    ...
```

**NEVER:**
```python
# ❌ WRONG - Don't use datetime directly
from datetime import datetime
now = datetime.utcnow()  # WRONG!

# ❌ WRONG - Don't use naive datetimes
now = datetime.now()  # Missing timezone!
```

**Why:** The `whenever` library handles:
- Timezone-aware operations (EST/EDT transitions)
- Market timezone (US Eastern) calculations
- DST transitions automatically
- Type-safe datetime operations

**Reference:** [apps/api/utils/timekeeper.py](../apps/api/utils/timekeeper.py)

---

### 3. Authentication & Permissions

**ALWAYS** check authentication for protected endpoints:

```python
from apps.api.routes.dependencies import CurrentUser, CurrentUserOrm

# For raw SQL endpoints:
@router.get("/data")
async def get_data(user: CurrentUser, db: Db):
    # user.id, user.email, user.account_tier available
    p = db.param_placeholder
    data = await db.fetch_dict_all(
        f"SELECT * FROM data WHERE user_id = {p}",
        (user.id,)
    )
    return data

# For ORM endpoints:
@router.get("/profile")
async def get_profile(user: CurrentUserOrm, db: DbSession):
    # user is full ORM object with relationships
    return user.sessions  # Already loaded
```

**Tier-based permissions:**
```python
from apps.api.routes.dependencies import CurrentUser

TIER_LEVELS = {
    "beginner": 1,
    "intermediate": 2,
    "pro": 3,
    "admin": 4,
}

def requires_tier(user: CurrentUser, required: str):
    if TIER_LEVELS[user.account_tier] < TIER_LEVELS[required]:
        raise HTTPException(403, f"Requires {required} tier or higher")

@router.get("/advanced-data")
async def get_advanced_data(user: CurrentUser):
    requires_tier(user, "pro")  # Pro+ only
    ...
```

**Reference:** [docs/web/AUTH.md](./web/AUTH.md)

---

### 4. Real-Time Data Pipeline Rules

**CRITICAL for market data ingestion:**

#### ✅ Use Raw SQL with psycopg3 (via DatabaseManager)

```python
from apps.api.db.manager import Db

async def ingest_quotes(db: Db, quotes: List[Dict]):
    p = db.param_placeholder

    # Batch insert for performance
    data = [
        (q["symbol"], q["price"], to_db_timestamp(now_utc()))
        for q in quotes
    ]

    await db.execute_many(
        f"INSERT INTO market_quotes (symbol, price, timestamp) VALUES ({p}, {p}, {p})",
        data
    )
```

#### ✅ Network Recovery Pattern

**Server-side** (pipeline auto-reconnect):
```python
class MarketDataPipeline:
    async def _fetch_with_retry(self, max_retries=3):
        for attempt in range(max_retries):
            try:
                return await self._fetch_data()
            except aiohttp.ClientError as e:
                if attempt == max_retries - 1:
                    logger.error(f"[Pipeline] Max retries exceeded: {e}")
                    # Notify via notification pipeline
                    await self._notify_connection_loss()
                    raise

                backoff = 2 ** attempt  # Exponential backoff
                logger.warning(f"[Pipeline] Retry {attempt + 1}/{max_retries} after {backoff}s")
                await asyncio.sleep(backoff)
```

**Client-side** (WebSocket auto-reconnect):
```typescript
class ServerProvider {
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5

    private async _attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            // Notify user via toast/notification
            notifyError("Market data connection lost")
            return
        }

        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)

        setTimeout(() => {
            this.connect().catch(err => {
                // Retry on failure
                this._attemptReconnect()
            })
        }, delay)
    }
}
```

#### ✅ Status Communication Pattern

**Integration with notification pipeline:**
```python
# Server notifies clients of pipeline status
from apps.api.services.notifications import notify_users

async def _on_pipeline_status_change(status: str, message: str):
    await notify_users(
        user_ids=[],  # Empty = all users
        notification={
            "type": "market_data_status",
            "status": status,  # "connected", "disconnected", "reconnecting"
            "message": message,
            "timestamp": to_db_timestamp(now_utc()),
        }
    )

# Client receives notification
socket.on("notification", (data) => {
    if (data.type === "market_data_status") {
        if (data.status === "disconnected") {
            showToast("Market data temporarily unavailable", "warning")
        } else if (data.status === "connected") {
            showToast("Market data connection restored", "success")
        }
    }
})
```

**Reference:** [docs/REALTIME_DATA_PIPELINE.md](./REALTIME_DATA_PIPELINE.md)

---

### 5. Error Handling & Logging

**ALWAYS use structured logging:**

```python
import logging

logger = logging.getLogger(__name__)

# GOOD - Structured with context
logger.info(f"[MarketData] Fetched {len(quotes)} quotes for {symbols}")
logger.error(f"[MarketData] Failed to fetch quotes: {error}", exc_info=True)

# BAD - Unstructured
print("Got quotes")  # ❌ Don't use print
logger.info("Error")  # ❌ No context
```

**Error handling pattern:**
```python
try:
    result = await risky_operation()
except SpecificException as e:
    logger.error(f"[Module] Specific error: {e}")
    raise HTTPException(400, detail="User-friendly message")
except Exception as e:
    logger.error(f"[Module] Unexpected error: {e}", exc_info=True)
    raise HTTPException(500, detail="Internal server error")
```

---

### 6. Configuration Management

**Two-tier config system:**

1. **Bootstrap settings** (`apps/api/core/config.py`) — needed before DB is up: `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `REDIS_URL`
2. **Dynamic settings** (`apps/api/services/settings/dynamic_settings.py`) — runtime-tunable, stored in `app_settings` DB table

**Priority:** `.env.local` > `app_settings` DB table > `config.py` defaults

```python
# For bootstrap settings (available immediately):
from apps.api.core.config import settings
redis_url = settings.REDIS_URL

# For runtime-tunable settings (after DB init):
# These are loaded by DynamicSettings on startup
# Access via DynamicSettings.get() or directly via settings fallback
```

**Adding new runtime settings:**
1. Add default to `apps/api/core/config.py` (fallback only)
2. Add seed row in a new migration:
```sql
INSERT INTO app_settings (key, value, value_type, category, description, is_secret)
VALUES ('MY_SETTING', '42', 'int', 'my_category', 'Description here', FALSE)
ON CONFLICT (key) DO NOTHING;
```

**NEVER hardcode configuration values:**
```python
redis_url = "redis://localhost:6379"  # ❌ WRONG
redis_url = settings.REDIS_URL        # ✅ CORRECT
```

---

### 7. FastAPI Lifecycle Integration

**ALWAYS integrate long-running services into lifespan:**

```python
# apps/api/main.py
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting background services...")
    await start_market_data_pipeline()  # Your service here

    yield

    # Shutdown
    logger.info("Stopping background services...")
    await stop_market_data_pipeline()

app = FastAPI(lifespan=lifespan)
```

**NEVER:**
- ❌ Start background tasks without shutdown hooks
- ❌ Use `@app.on_event("startup")` (deprecated in FastAPI)

---

### 8. API Endpoint Structure

**Follow versioned routing pattern:**

```
apps/api/routes/
  v1/
    __init__.py          # Registers all routers
    endpoints/
      market_data.py     # REST endpoints
      market_data_ws.py  # WebSocket endpoints
```

**Register new endpoints:**
```python
# apps/api/routes/v1/__init__.py
from .endpoints import market_data, market_data_ws

api_router.include_router(market_data.router, prefix="/market-data", tags=["Market Data"])
api_router.include_router(market_data_ws.router, prefix="/ws", tags=["WebSocket"])
```

---

### 9. Database Migrations

**PostgreSQL only.** Migrations are auto-applied on startup by `migration_runner.py`. No inline schema files — all table creation goes through numbered SQL migrations.

**Full guide:** [docs/api/Database-Migrations.md](./api/Database-Migrations.md) — creating migrations, modifying tables, bootstrap detection, checklist.

**Quick steps when touching the DB:**
1. Create `apps/api/db/migrations/NNN_description_postgresql.sql`
2. Use idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
3. Add entry to `_MIGRATION_MARKER_TABLES` in `migration_runner.py` (if new table)
4. Restart server — runner applies it automatically

**Migration template:**
```sql
-- Migration XXX: Feature Name
-- Purpose: What this migration does
-- Database: PostgreSQL
-- Created: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS my_table (
    id SERIAL PRIMARY KEY,
    ...
);

CREATE INDEX IF NOT EXISTS idx_my_table_field ON my_table(field);

COMMENT ON TABLE my_table IS 'Description';
```

---

### 10. State Persistence & Crash Recovery

**CRITICAL:** All long-running services MUST be stateful and support crash recovery.

**Use state management for:**
- Background workers (market data pipeline, screeners, bots)
- Long-running tasks that can't be restarted from scratch
- Services that process time-sensitive data

**Pattern:**
```python
from apps.api.services.market_data.state import get_state, shutdown_state
from apps.api.utils.timekeeper import now_utc

class MyService:
    def __init__(self):
        self.state = None

    async def start(self):
        # Load persistent state from DB (pipeline_state table)
        self.state = await get_state()

        # Check if resuming from crash
        if self.state.was_unclean_shutdown():
            logger.warning("[MyService] Resuming from crash")
            await self._recover_from_crash()

        # Continue from last known position
        last_cursor = self.state.get_last_quote_fetch()
        if last_cursor:
            logger.info(f"[MyService] Resuming from {last_cursor}")

    async def _do_work(self):
        # Perform work
        result = await self._fetch_data()

        # Update state after successful operation
        await self.state.update_quote_fetch(now_utc())

    async def stop(self):
        # Persist final state
        await self.state.shutdown()
```

**State is stored in `pipeline_state` table (single-row, id=1):**
- `last_quote_fetch`, `last_snapshot`, `last_cleanup` (TIMESTAMPTZ)
- `symbol_cursors` (JSONB) - per-symbol fetch cursors
- `active_symbols` (TEXT[]) - monitored symbols
- `pipeline_status` (VARCHAR) - "running", "stopped", "error"
- `error_count`, `last_error` (JSONB)

See migration: `apps/api/db/migrations/011_pipeline_state_postgresql.sql`

**Key features:**
- ✅ **DB-backed** - No JSON files, survives container restarts
- ✅ **Auto-recovery** - Detects unclean shutdown (status left as "running")
- ✅ **Crash-resistant** - Resumes exactly where it left off
- ✅ **Batched writes** - Dirty flag + periodic flush (every 10s)
- ✅ **In-memory cache** - Fast reads, async flush to DB

**Integration with FastAPI lifespan:**
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await start_market_data_pipeline()  # Loads state from DB
    yield
    await stop_market_data_pipeline()   # Persists state to DB
```

**Reference:** [apps/api/services/market_data/state.py](../apps/api/services/market_data/state.py)

---

### 11. Feature Documentation Requirements

**CRITICAL:** Every major feature MUST have accompanying documentation.

**When to create feature documentation:**
- New background services (pipelines, schedulers, workers)
- New API endpoints or modules
- Integration with external services
- Complex algorithms or business logic
- Anything that requires >500 lines of code

**Required documentation structure:**

```markdown
# Feature Name

**Status:** 🏗️ In Development / ✅ Production / 🔴 Critical
**Author:** [Team/Person]
**Date:** YYYY-MM-DD
**Version:** X.Y.Z

---

## Overview

Brief description of what this feature does and why it exists.

## Architecture

System design, data flow diagrams, component interactions.

## Features

### Implemented
- ✅ Feature 1
- ✅ Feature 2

### Planned
- 🔜 Future feature 1
- 🔜 Future feature 2

## Design Philosophy / Ideology

Core principles and design decisions:
- Why this approach was chosen
- Trade-offs considered
- Architectural patterns used

## API Reference

Endpoints, function signatures, usage examples.

## Configuration

Environment variables, settings, deployment requirements.

## Testing

How to test, example test cases.

## Troubleshooting

Common issues and solutions.

## References

Links to related docs, external resources.
```

**File location pattern:**
```
docs/
  features/
    REALTIME_DATA_PIPELINE.md      ← Major features get dedicated docs
    SCREENER_SYSTEM.md
    NOTIFICATION_PIPELINE.md
  api/
    DATABASE_ARCHITECTURE.md        ← Architecture docs
  web/
    AUTH.md                         ← Subsystem docs
```

**Example - Real-Time Data Pipeline:**
- [docs/REALTIME_DATA_PIPELINE.md](./REALTIME_DATA_PIPELINE.md)
- Includes: architecture, database schema, implementation phases, configuration
- **Ideology:** Server-independent, crash-resistant, client-choice for data sources

**Always update documentation when:**
- ✅ Adding new features
- ✅ Changing behavior
- ✅ Deprecating features
- ✅ Fixing critical bugs

**NEVER:**
- ❌ Create code without documentation
- ❌ Leave TODOs without tracking
- ❌ Skip "Planned Features" section (roadmap visibility)

---

### 12. Testing Requirements

**CRITICAL:** All code MUST have corresponding unit tests that mirror the `apps/api/` structure.

**Test file structure mirrors source:**
```
apps/api/
  services/
    market_data/
      pipeline.py          ← Source file
      providers.py

tests/                     ← Mirror structure here
  api/
    services/
      market_data/
        test_pipeline.py   ← Test file (add "test_" prefix)
        test_providers.py
```

**When to create tests:**
- ✅ **ALWAYS** - For every new module, class, or function
- ✅ New API endpoints
- ✅ Database operations
- ✅ Business logic
- ✅ Utility functions
- ✅ Background services

**Test framework:**
```python
import unittest

# For sync code
class TestMyFeature(unittest.TestCase):
    def setUp(self):
        """Set up before each test"""
        pass

    def test_feature_works(self):
        """Test normal operation"""
        result = my_feature()
        self.assertEqual(result, expected)

# For async code (ALWAYS use for FastAPI/DB code)
class TestAsyncFeature(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        """Set up async fixtures"""
        self.db = await get_db()

    async def asyncTearDown(self):
        """Clean up async resources"""
        await self.db.close()

    async def test_async_operation(self):
        """Test async operation"""
        result = await async_function()
        self.assertEqual(result, expected)
```

**Running tests:**
```bash
# Run all tests
uv run pytest

# Run specific module tests
uv run pytest tests/api/services/market_data/ -v

# Run with coverage
uv run pytest --cov=apps --cov-report=html
```

**Coverage requirements:**
- ✅ Aim for >80% code coverage
- ✅ 100% coverage for critical paths (auth, trading, payments)
- ✅ Test both success and error cases
- ✅ Test edge cases (empty input, None, invalid data)

**Reference:** [docs/TESTING.md](./TESTING.md) - Complete testing guide with examples

---

### 13. Client-Side Best Practices

**React hooks for real-time data:**
```typescript
import { useMarketData } from '@/lib/market-data/context'

function StockQuote({ symbol }: { symbol: string }) {
    const { subscribe, unsubscribe } = useMarketData()
    const [quote, setQuote] = useState<Quote | null>(null)

    useEffect(() => {
        subscribe([symbol], setQuote)
        return () => unsubscribe([symbol])
    }, [symbol])

    return <div>${quote?.price}</div>
}
```

**Provider abstraction pattern:**
```typescript
// ALWAYS use provider abstraction (server, schwab, orats)
const provider = createProvider(userDataSource)
provider.subscribe(symbols, callback)

// NEVER hardcode data source
const ws = new WebSocket("ws://...") // ❌ Hardcoded
```

---

## 📂 File Structure Reference

```
apps/
  api/
    main.py                    # FastAPI app with lifespan
    core/
      config.py                # Bootstrap settings (.env.local + defaults)
    db/
      manager.py               # DatabaseManager (Db, DbSession, singleton)
      database.py              # SQLAlchemy Base class
      adapters/
        postgresql.py          # psycopg3 adapter
      migrations/              # PostgreSQL migrations (auto-applied)
      migration_runner.py      # Auto-runs migrations on startup
    models/
      models.py                # ORM models
    schemas/
      schemas.py               # Pydantic schemas
    routes/
      dependencies.py          # Auth deps, UserScopedQuery
      v1/
        endpoints/             # API endpoints
    services/
      settings/
        dynamic_settings.py    # DB-backed runtime config
      market_data/
        pipeline.py            # Background ingestion
        state.py               # Pipeline state (DB-backed)
        providers.py           # Data source adapters
    utils/
      timekeeper.py            # Time management (use this!)
    bot/
      {bot_name}/
        router.py              # Bot-specific endpoints

web/
  src/
    lib/
      market-data/
        provider.ts            # Provider abstraction
        server-provider.ts     # WebSocket client
        context.tsx            # React context + hooks

docs/
  AI-Development-Guide.md     # This file
  REALTIME_DATA_PIPELINE.md    # Pipeline architecture
  api/
    DATABASE_ARCHITECTURE.md   # DB patterns
  web/
    AUTH.md                    # Authentication system
```

---

## 🚫 Common Mistakes to Avoid

1. ❌ **Using ORM for time series data** → Use raw SQL
2. ❌ **Importing `datetime` directly** → Use `timekeeper.py`
3. ❌ **SQL injection via string interpolation** → Use parameterized queries
4. ❌ **N+1 queries with ORM** → Use `selectinload()`
5. ❌ **Hardcoding configuration** → Use `settings` / DynamicSettings
6. ❌ **Forgetting lifecycle hooks** → Integrate services into lifespan
7. ❌ **No error recovery** → Always handle network failures
8. ❌ **Missing auth checks** → Use `CurrentUser` dependency
9. ❌ **Ignoring timezone** → Use market timezone for trading
10. ❌ **Client-side data source hardcoding** → Use provider abstraction
11. ❌ **No feature documentation** → Create .md for every major feature
12. ❌ **No state persistence** → Long-running services must support crash recovery
13. ❌ **Using SQLite or adding SQLite branches** → PostgreSQL only, no dual-DB code
14. ❌ **JSON state files** → Use `pipeline_state` DB table for pipeline state

---

## ✅ Checklist for New Features

Before submitting code, verify:

- [ ] Uses `Db` (raw SQL) for performance-critical ops, `DbSession` (ORM) for relationships
- [ ] Uses `timekeeper.py` for all datetime operations
- [ ] Includes authentication checks (`CurrentUser` or `CurrentUserOrm`)
- [ ] Handles network errors with retry + exponential backoff
- [ ] Integrates into FastAPI lifespan (if long-running)
- [ ] Creates PostgreSQL migration file (if database changes)
- [ ] Uses `settings` / DynamicSettings for configuration (no hardcoded values)
- [ ] Structured logging with context (`logger.info(f"[Module] ...")`)
- [ ] Client uses provider abstraction (not hardcoded WebSocket)
- [ ] Respects account tiers for premium features
- [ ] **Has feature documentation** (`.md` file in `docs/` or `docs/features/`)
- [ ] **State persistence** via DB table (if long-running service)
- [ ] Documentation includes: Overview, Architecture, Features (Implemented + Planned), Ideology
- [ ] Uses `RETURNING *` for INSERT/UPDATE queries (PostgreSQL)

---

## 📚 Additional Resources

- [Database Architecture](./api/DATABASE_ARCHITECTURE.md) - Hybrid SQL/ORM patterns
- [Authentication System](./web/AUTH.md) - better-auth integration
- [Real-Time Data Pipeline](./REALTIME_DATA_PIPELINE.md) - Market data architecture
- [CLAUDE.md](../CLAUDE.md) - Quick start guide for AI assistants
- [Architecture.md](./Architecture.md) - Overall system architecture

---

## 🎯 TL;DR - Most Important Rules

1. **DB:** PostgreSQL only. Raw SQL (`Db`) for performance, ORM (`DbSession`) for relationships
2. **Time:** ALWAYS use `timekeeper.py`, NEVER `datetime` directly
3. **Auth:** ALWAYS check `CurrentUser` for protected endpoints
4. **Network:** ALWAYS implement retry logic with exponential backoff
5. **Config:** Use `settings` for bootstrap, DynamicSettings for runtime-tunable values
6. **Lifecycle:** ALWAYS integrate long-running services into lifespan
7. **Client:** ALWAYS use provider abstraction, NEVER hardcode data sources
8. **Docs:** ALWAYS create feature documentation (`.md`) for major features
9. **State:** Use `pipeline_state` DB table — no JSON files for state persistence
10. **SQL:** Use `RETURNING *` for INSERT/UPDATE, `%s` params, no SQLite branches

**When in doubt, refer to existing code in the same domain (e.g., check `apps/api/bot/earnings_edge/` for bot patterns).**

---

**Last Updated:** 2026-02-23
**Maintainer:** System Architecture
**Status:** 🔴 **CRITICAL** - Must be followed by all AI assistants
