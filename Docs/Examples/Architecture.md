**Speed Architecture & Trading Bot Master Plan**

```markdown
   _____                     _                     _     _ _            _                             _______            _ _               ____        _     __  __           _              _____  _             
  / ____|                   | |     /\            | |   (_) |          | |                    ___    |__   __|          | (_)             |  _ \      | |   |  \/  |         | |            |  __ \| |            
 | (___  _ __   ___  ___  __| |    /  \   _ __ ___| |__  _| |_ ___  ___| |_ _   _ _ __ ___   ( _ )      | |_ __ __ _  __| |_ _ __   __ _  | |_) | ___ | |_  | \  / | __ _ ___| |_ ___ _ __  | |__) | | __ _ _ __  
  \___ \| '_ \ / _ \/ _ \/ _` |   / /\ \ | '__/ __| '_ \| | __/ _ \/ __| __| | | | '__/ _ \  / _ \/\    | | '__/ _` |/ _` | | '_ \ / _` | |  _ < / _ \| __| | |\/| |/ _` / __| __/ _ \ '__| |  ___/| |/ _` | '_ \ 
  ____) | |_) |  __/  __/ (_| |  / ____ \| | | (__| | | | | ||  __/ (__| |_| |_| | | |  __/ | (_>  <    | | | | (_| | (_| | | | | | (_| | | |_) | (_) | |_  | |  | | (_| \__ \ ||  __/ |    | |    | | (_| | | | |
 |_____/| .__/ \___|\___|\__,_| /_/    \_\_|  \___|_| |_|_|\__\___|\___|\__|\__,_|_|  \___|  \___/\/    |_|_|  \__,_|\__,_|_|_| |_|\__, | |____/ \___/ \__| |_|  |_|\__,_|___/\__\___|_|    |_|    |_|\__,_|_| |_|
        | |                                                                                                                         __/ |                                                                         
        |_|                                                                                                                        |___/                                                                          
```

# ⚡ Speed Architecture & Trading Bot Master Plan

## 📑 Index

1.  [**Tech Stack Overview**](#1-tech-stack-overview) - *The Libraries, Tools & Priorities*
2.  [**Architecture Ideologies**](#2-architecture-ideologies) - *Air Gaps, Isolation & State*
3.  [**Infrastructure & Services**](#3-infrastructure--services) - *The Server & Bus Layer*
4.  [**Resilience & Recovery**](#4-resilience--recovery) - *The 3-Pillar Recovery System*
5.  [**Component Design**](#5-component-design) - *Strategy Brain, Execution Hands, Data Eyes*
6.  [**Deep Dive Logic Flows**](#6-deep-dive-logic-flows) - *Earnings Bots, Modular Data, Visualizers*
7.  [**Safety & Governance System**](#7-safety--governance-system) - *Risk Kill Switch, Alerts, Audit Logs*
8.  [**Implementation Details**](#8-implementation-details) - *DB Schema, Pseudo-code & Crash Walkthroughs*
9.  [**Visual Architecture Maps**](#9-visual-architecture-maps) - *System Diagrams*
10. [**Monorepo Folder Structure**](#10-monorepo-folder-structure) - *System Diagrams*

---

### 🔑 Priority Key
*   **[T1] MVP (Mission Critical):** Essential to run the Earnings Strategy Bot on a single account safely.
*   **[T2] Scaling (Enhanced):** Required for multiple accounts, Strategy Builder UI, Compliance, and "Smart" Execution.
*   **[T3] Advanced (Future):** Complex Visualizations, Backtesting Engines, AI Agents.

---

## 1. Tech Stack Overview

### 🐍 1. Core Backend & Utilities
| Library | Category | Priority | Usage |
| :--- | :--- | :--- | :--- |
| **FastAPI** | Framework | **[T1]** | High-performance async API. |
| **uv** | Package Manager | **[T1]** | Ultra-fast Python package/project manager. |
| **whenever** | Date/Time | **[T1]** | 1. Modern, timezone-safe datetime library. |
| **icecream** | Debugging | **[T1]** | 1. `ic()` for formatted inspection.<br>2. **tabulate**: ASCII CLI tables. |
| **Pydantic v2** | Validation | **[T1]** | Strict type enforcement and serialization. |
| **dotenv** | Config | **[T1]** | Environment variable management. |

### ⚙️ 2. Execution, Queues & Orchestration
| Library Grouping | Priority | Usage / Ranking |
| :--- | :--- | :--- |
| **Temporal** | **[T1]** | **1. Temporal:** Primary for durable, multi-step order execution.<br>&nbsp;&nbsp;&nbsp;↳ **2. Prefect:** Orchestration for data-heavy flows/models.<br>&nbsp;&nbsp;&nbsp;↳ **3. Kew:** Async-native Redis task queue for FastAPI.<br>&nbsp;&nbsp;&nbsp;↳ **4. Celery:** Legacy heavy-duty distributed task queue. |
| **DBOS (Transact)** | **[T1]** | **1. DBOS:** Library-level durable state inside Postgres.<br>&nbsp;&nbsp;&nbsp;↳ **2. PGQueuer:** Minimalist job queueing built on PG. |
| **Tenacity** | **[T1]** | Advanced retry logic for flaky API endpoints. |

### 📊 3. Data Engineering & Calculations
| Library Grouping | Priority | Usage / Ranking |
| :--- | :--- | :--- |
| **Polars** | **[T1]** | **1. Polars:** Primary high-speed Rust-based DataFrame.<br>&nbsp;&nbsp;&nbsp;↳ **2. Narwhals:** Agnostic compatibility layer for DFs. |
| **ArcticDB** | **[T1]** | Serverless DataFrame database for tick/time-series data. |
| **Streamable** | **[T2]** | **1. Streamable:** Chaining lazy concurrent operations.<br>&nbsp;&nbsp;&nbsp;↳ **2. Joblib:** Caching and heavy process-based parallelization. |
| **openpyxl** | **[T3]** | Excel data exporting and reporting. |

### 📈 4. Trading & Market Connectivity
| Library | Category | Priority | Usage |
| :--- | :--- | :--- | :--- |
| **Nautilus Trader**| Execution | **[T1]** | Rust/Python engine for backtesting and live execution. |
| **schwabdev** | Broker API | **[T1]** | Unofficial wrapper for Schwab execution/data. |
| **ORATS** | Options Data | **[T1]** | Historical and live Options Greeks. |

### 🕸️ 5. Automation & Scraping
| Library Grouping | Priority | Usage / Ranking |
| :--- | :--- | :--- |
| **Playwright** | **[T1]** | **1. Playwright:** Primary, robust browser automation.<br>&nbsp;&nbsp;&nbsp;↳ **2. nodriver:** Undetectable automation (no ChromeDriver).<br>&nbsp;&nbsp;&nbsp;↳ **3. pyppeteer:** Fast, async headless Chrome.<br>&nbsp;&nbsp;&nbsp;↳ **4. PyAutoGUI:** OS-level mouse/keyboard control. |
| **Crawlee-Python** | **[T2]** | **1. Crawlee:** Full-scale scraping/crawling framework.<br>&nbsp;&nbsp;&nbsp;↳ **2. cloudscraper:** Bypassing Cloudflare protections.<br>&nbsp;&nbsp;&nbsp;↳ **3. UIVision:** Browser-extension based automation. |

### 🗄️ 6. Infrastructure & DB
| Library | Category | Priority | Usage |
| :--- | :--- | :--- | :--- |
| **psycopg3** | DB Adapter | **[T1]** | 1. Async-native PostgreSQL adapter.<br>2. PostgreSQL only — no SQLite support. |
| **aio-pika** | Messaging | **[T2]** | 1. Async RabbitMQ wrapper for signals/notifications. |
| **Unittest** | Testing | **[T1]** | 1. Standard test suite (184+ passing tests).<br>2. **MagicMock**: Mocking API responses and objects.<br>3. **pytest**: Test runner with better output. |

Here is the updated **Frontend & Visualization** section. I have positioned **TanStack Start** as the primary framework, supported by the reasoning for why it supersedes Next.js for this specific high-performance trading architecture.

### 🖥️ 7. Frontend & Visualization
| Technology Grouping | Priority | Usage / Ranking |
| :--- | :--- | :--- |
| **Framework & Routing** | **[T1]** | **1. TanStack Start:** Primary framework. Full-stack SSR with Vite speed and "God-tier" type safety.<br>&nbsp;&nbsp;&nbsp;↳ **2. Next.js 16:** Alternative for SEO-heavy/marketing pages.<br>&nbsp;&nbsp;&nbsp;↳ **3. Vite (Pure SPA):** The "no-SSR" fallback for purely internal dashboarding. |
| **Perspective** | **[T1]** | **1. Perspective (JP Morgan):** Streaming Trade Blotter tables (WASM-based).<br>&nbsp;&nbsp;&nbsp;↳ **2. TanStack Table:** Standard headless UI tables for static data. |
| **Lightweight Charts**| **[T1]** | **1. Lightweight Charts:** Canvas-based price action/PnL curves.<br>&nbsp;&nbsp;&nbsp;↳ **2. Plotly Resampler:** Visualizing massive (100k+) tick sets via backend downsampling.<br>&nbsp;&nbsp;&nbsp;↳ **3. visx:** Low-level primitives for custom heatmaps and Greek surfaces. |
| **State Management** | **[T1]** | **1. TanStack Query:** Server-state management (syncing FastAPI data).<br>&nbsp;&nbsp;&nbsp;↳ **2. Zustand:** Ultra-lightweight global client state (UI toggles, sidebar). |

---

### 🧠 Why TanStack Start is #1 for this Stack

1.  **Vite-Native (Speed):** Unlike Next.js, which uses Webpack/Turbopack, TanStack Start is built on **Vite**. This means faster Hot Module Replacement (HMR) and a much simpler build process that fits perfectly with your **uv/Python** high-speed philosophy.
2.  **Type-Safe Routing & Loaders:** Since you are using **Pydantic v2** on the backend, TanStack Start allows you to enforce that type-safety all the way into your UI routes. Its "Loaders" fetch data *before* the page renders, eliminating the "layout shift" and loading spinners common in pure React apps.
3.  **Monorepo Optimization:** TanStack Start handles **multiple packages** (monorepos) significantly better than Next.js. You can share route definitions, API clients, and UI components across different "apps" (e.g., a Bot Controller app and a Backtesting app) without the "finicky" configuration errors Next.js often throws.
4.  **No "Black Box" Caching:** Next.js 14/15 introduced aggressive server-side caching that is difficult to opt-out of. For a trading app where **stale data = lost money**, TanStack Start gives you full control over exactly when data is revalidated.
5.  **Perfect Synergy:** You are already using **TanStack Query**. TanStack Start is designed by the same team to be the "missing link" between your router and your data, creating a single, cohesive developer experience.

---

### 📝 Strategic Integration Note: Monorepo Structure
With **TanStack Start** as your #1, your project structure should look like this:
*   `web/`: The main TanStack Start app (frontend dashboard).
*   `apps/api/`: Python FastAPI backend.
*   `packages/shared-types/`: Shared TypeScript types generated from your **FastAPI Pydantic** models.
*   `packages/ui/`: Shared **shadcn/ui** components.
---

### 📝 Strategic Implementation Notes

1.  **Durable Workflow Choice:** 
    *   Use **Temporal** for "Critical Path" trade logic (Order -> Fill -> SL) where persistence across restarts is mandatory. 
    *   Use **Prefect** for the "Data Layer" (re-calculating daily greeks, updating historical DBs).
2.  **Scraping Strategy:** 
    *   Start with **Playwright**. If the site detects you, pivot to **nodriver**. If the site is protected by Cloudflare, wrap the request in **cloudscraper**.
3.  **Debugging:** 
    *   Use **Icecream** for logic debugging. For viewing raw database states in the terminal during development, use **peepdb** or **tabulate** to format the SQL output.

---

### 🔧 1A. Runtime Configuration System **[T1]**

A dynamic settings management system that allows configuration changes without server restarts.

#### Features
- **DB-Backed**: Settings stored in `app_settings` table with typed values and categories
- **Runtime Overrides**: Modify settings via REST API without restarting the application
- **Priority Chain**: `.env.local` (highest) > `app_settings` DB table > `config.py` defaults (lowest)
- **Audit Trail**: All changes logged in `app_settings_audit` with user ID and timestamp
- **Authentication**: All endpoints require authenticated user access (superuser for writes)
- **Secret Masking**: Sensitive values (`is_secret=True`) masked as `***` in API responses

#### API Endpoints
- `GET /api/v1/settings/categories` - List all setting categories
- `GET /api/v1/settings/categories/{category}` - Get settings by category with override status
- `PUT /api/v1/settings/{key}` - Update setting at runtime (superuser only)
- `GET /api/v1/settings/{key}/history` - View change audit trail
- `GET /api/v1/settings/health` - Settings health check (shows `.env.local` overrides)

#### Use Cases
- **Broker Configuration**: Update API keys without downtime
- **Feature Toggles**: Enable/disable screener schedules dynamically
- **Rate Limiting**: Adjust API throttling based on real-time conditions
- **Provider Switching**: Change data providers (ORATS ↔ Yahoo Finance) on the fly

**Implementation:** [apps/api/services/settings/dynamic_settings.py](../apps/api/services/settings/dynamic_settings.py)
**Documentation:** [docs/Dynamic-Settings.md](Dynamic-Settings.md)

---

### 🗄️ 1B. Database: Hybrid PostgreSQL Architecture **[T1]**

**Status:** ✅ Complete — PostgreSQL only, no SQLite support

A hybrid database architecture combining raw SQL (psycopg3) for performance-critical operations with SQLAlchemy ORM for relationship management.

#### Architecture Components

**1. PostgreSQL Adapter** ([apps/api/db/adapters/postgresql.py](../apps/api/db/adapters/postgresql.py))
- Async connection pooling (2-10 connections) via psycopg3
- Parameterized queries (`%s` placeholders)
- Automatic reconnection with exponential backoff

**2. Database Manager** ([apps/api/db/manager.py](../apps/api/db/manager.py))
- **Singleton Pattern**: Thread-safe singleton with crash recovery
- **Dual Access**: Raw SQL (`Db` dependency) + ORM (`DbSession` dependency)
- **Health Monitoring**: Background health checks every 60s
- **Migration Runner**: Auto-applies numbered SQL migrations on startup

**3. Pipeline State** ([apps/api/services/market_data/state.py](../apps/api/services/market_data/state.py))
- DB-backed state in `pipeline_state` table (single-row, id=1)
- In-memory cache with dirty flag + periodic flush
- Crash detection via `pipeline_status` column

**4. Datetime Utilities** ([apps/api/utils/timekeeper.py](../apps/api/utils/timekeeper.py))
- **Whenever Package**: Modern timezone-aware datetime library (replaces Python `datetime`)
- Database timestamp conversion (ISO 8601 / PostgreSQL TIMESTAMPTZ)
- Cache validity checks and TTL management
- Pydantic serialization support

#### Key Benefits
- **Performance**: Raw SQL for time series, market data, trading operations
- **Relationships**: ORM for User ↔ Sessions, cascade deletes, eager loading
- **PostgreSQL-native**: `RETURNING *`, `UNNEST()`, `INTERVAL`, proper booleans
- **Resilience**: DB-backed state persistence enables crash recovery
- **Modern Stack**: psycopg3 + whenever for type-safe, timezone-aware operations

**Documentation:**
- [api/Database-Architecture.md](api/Database-Architecture.md) - Hybrid DB patterns
- [Dynamic-Settings.md](Dynamic-Settings.md) - DB-backed runtime config

---

## 2. Architecture Ideologies

To achieve an institutional-grade OMS (Order Management System), we adhere to these principles:

### A. The "Air Gap" Pattern **[T2]**
Decoupling the "Brain" from the "Hands" to prevent cross-account contamination.
*   **Strategy Engine:** Decides *what* to do. It knows math, signals, and "recipes", but never touches account credentials.
*   **Execution Vault:** Knows *how* to do it. It holds the keys and connects to Schwab.
*   **Communication:** They talk *only* via `OrderIntent` objects passed through strict queues.

### B. Account Sharding **[T2]**
*   **Concept:** Every brokerage account gets a dedicated "Worker Lane" (Executor).
*   **Safety:** Executor A (Account A) cannot technically access the memory space or API session of Executor B (Account B).
*   **Benefit:** If Account A gets rate-limited or banned, Account B continues trading without interruption.
*   **Queues:** Specific topics like `queue.acct_A55` (Cash) and `queue.acct_B99` (Margin).

### C. State-First Design (The "Save Game") **[T1]**
*   **Concept:** A bot is never defined by "Variables in Memory." It is defined by "Rows in a Database."
*   **Rule:** If the server is unplugged, the bot must resume exactly where it was upon reboot without human intervention.
*   **Implementation:** We do not run `while True` loops; we run DBOS workflows that commit state at every step.

---

## 3. Infrastructure & Services

| Component | Usage |
| :--- | :--- |
| **PostgreSQL** | **Double Duty:** Stores App Data (Trades/Users/Strategy Configs) AND Prefect/DBOS Flow State. |
| **Prefect Server** | **Self-Hosted Container.** The UI/API that triggers bots. logs runs, and manages the worker pool. |
| **Redis** | **Hot Cache.** Live market data (sub-ms reads) and API rate limiting. |
| **RabbitMQ** | **Signal & Execution Bus.** <br>1. Broadcasts price ticks (Backend -> Frontend).<br>2. Routes `OrderIntents` (Strategy -> Executor). |

---

## 4. Resilience & Recovery

We move away from standard programming to **Durable Execution**.

### The 3-Pillar Recovery Architecture **[T1]**

#### 1. The "Checkpoint" Engine (DBOS / Persistent State)
Instead of a bot running a continuous `while True` loop in Python memory, every "action" the bot takes is a **Database Transaction**.

*   **How it works:** We use **DBOS** (or a state machine pattern in Postgres).
*   **The Logic:**
    1.  Bot calculates "Buy Signal".
    2.  **COMMIT to DB:** `BotState = "SIGNAL_GENERATED"`, `Target = "SPY"`.
    3.  Bot sends Order to Executor.
    4.  **COMMIT to DB:** `BotState = "ORDER_SENT"`, `OrderID = "UUID-123"`.
    5.  Bot waits for fill.
*   **The Recovery:** If the server crashes between Step 3 and 4, when it restarts, DBOS looks at the DB, sees `SIGNAL_GENERATED`, and **re-runs Step 3**. It does *not* re-run Step 1 or 2.

#### 2. The "Idempotency" Key (The Anti-Duplicate Shield)
This is the most critical part for financial execution.
*   **The Problem:** Server crashes *while* sending an order. Did Schwab receive it? We don't know.
*   **The Solution:** Client-Side Generated UUIDs.
*   **The Flow:**
    1.  Before calling Schwab, we generate a UUID: `ord_55a9c...`
    2.  We save this UUID to our DB *before* sending the network request.
    3.  We send the order to Schwab with `client_order_id = "ord_55a9c..."`.
    4.  **CRASH!**
    5.  **Restart:** The bot sees it has a pending order `ord_55a9c...`. It sends it *again*.
    6.  **Broker Check:** Schwab sees the ID.
        *   *If they already got it:* They return "Duplicate Order" (safe) or just return the status of the existing one.
        *   *If they didn't get it:* They execute it.
    *   **Result:** You never accidentally double-buy.

#### 3. The "Reconciliation" Worker (The Truth Seeker)
This is a dedicated background process that runs on startup and periodically (every 1 min).
*   It downloads the **Official Trade Ledger** from Schwab/ORATS.
*   It compares it to your **Local Database**.
*   **Self-Healing Logic:**
    *   *Local says "Pending", Schwab says "Filled":* **UPDATE** Local to "Filled", Trigger Bot "Next Step".
    *   *Local says "Open", Schwab says "Does Not Exist":* **ALERT** User or Mark Local as "Failed".

---

## 5. Component Design

### A. The Market Data Abstraction Layer (The Eyes)
*Goal: Switch between Schwab, ORATS, or Polygon without breaking the app.*
*   **Interface [T1]:** `IMarketDataProvider`.
*   **Adapters:**
    *   `SchwabAdapter`: Live price for execution.
    *   `OratsAdapter`: Greeks/IV for strategy math.
*   **Snapshot Manager [T2]:** Merges data. If viewing dashboard, pulls from "App Wide Provider". If Bot is running, pulls from specific high-speed source.

### B. The Strategy Engine (The Brain)
*   **Strategy Builder [T2]:** Strategies defined as JSON/Pydantic "Recipes".
    *   *Example Parameter:* `EarningsPlay(ticker="NVDA", delta=0.30, entry_time="market_close_minus_5m")`.
*   **The "Optimizer" (Smart Execution Logic) [T2]:**
    *   Contains the "Sell ASAP at best price" logic.
    *   **Micro-loop:** Check Bid/Ask Spread -> Check Volume -> Place Limit at Midpoint -> Wait 3s -> If no fill, cancel and move 1 tick towards the bid.

### C. The Execution Core (The "Vault")
*Goal: Absolute Isolation.*
*   **Dispatcher:** Receives `OrderIntent`. Lookups Account ID. Routes to `AccountQueue`.
*   **Account Executor (The Worker) [T2]:**
    *   One instance per Brokerage Account.
    *   Initializes its *own* HTTP session with Schwab using *only* that account's credentials.
    *   **Queue Management:** Maintains local queue to throttle API limits (e.g., 10 orders/sec).

---

## 6. Deep Dive Logic Flows

#### A. The "Modular Data" Flow
1.  **Requirement:** User wants to see an Option Chain on the UI.
2.  **UI Request:** `GET /api/market/chain?symbol=SPY&provider=default`
3.  **Data Facade:** Checks config. `Default` = `ORATS`.
4.  **Adapter:** Calls `ORATSAdapter.get_chain("SPY")`.
5.  **Normalization:** Converts ORATS specific JSON into your standard `OptionChain` Pydantic model.
6.  **Switch:** If user toggles "Use Live Execution Prices", Facade switches to `SchwabAdapter` instantly.

#### B. The "Earnings Bot" Flow (with Backtesting)
1.  **Creation:** User goes to "Strategy Builder". Selects "Earnings Volatility Crush".
    *   *Parameters:* `Entry: 3:55 PM EST`, `Legs: Short Strangle`, `Exit: 9:35 AM EST`.
2.  **Backtest:** User clicks "Simulate".
    *   The **Backtest Sub-Bot** spins up. It pulls historical data (from ORATS/Polygon archive), runs the logic, and generates a PnL graph.
3.  **Live Deployment:** User assigns "Account A (Margin)" and allocates $5,000.
4.  **Runtime:**
    *   **DBOS** creates a persistent workflow.
    *   It waits (sleeps) until 3:55 PM.
    *   At 3:55 PM, it calculates the Greeks to find the right strikes.
    *   It sends an `OrderIntent` to the **Smart Router**.
5.  **Execution:**
    *   Router drops msg into `queue.acct_A`.
    *   **Executor A** picks it up. It sees "Smart Limit Strategy".
    *   It places orders at the mid-price. It watches the order status. If not filled in 5 seconds, it updates the price (Walking the limit).
    *   Once filled, it notifies the Bot: "Position Open".
    *   Bot updates State to "Holding Overnight".

#### C. The Option Spread Visualizer (Future Proofing)
Since you want to visualize "Predicted Greeks," the **Strategy Engine** is designed to calculate this *before* execution.
*   When a user creates a strategy, the backend runs a "What-If" analysis using **Polars**:
    *   *Scenario A:* Stock goes up 5%, IV drops 10%.
    *   *Scenario B:* Stock stays flat, Time passes 3 days.
*   This data is sent to the frontend **Lightweight Charts** (or a custom Canvas chart) to draw the PnL curve *before* the user clicks "Start Bot".


---

## 7. Safety & Governance System

### 🛡️ Risk Manager "Kill Switch" **[T1]**
*   **What:** Global middleware that checks PnL before *every* order.
*   **Mechanism:** Intercepts `OrderIntent` before it hits the Execution Queue.
*   **Logic:**
    *   `IF Daily_Loss > $500 THEN REJECT (Raise RiskException)`.
    *   `IF Open_Positions > Max_Allowed THEN REJECT`.
*   **Why:** Prevents a buggy bot from draining an account in seconds.

### 🔔 Notification Hub **[T2]**
*   **What:** Centralized alert system listening to RabbitMQ events (via **Apprise**).
*   **Usage:**
    *   `INFO`: "Bot Started", "Earnings Play Analyzing..."
    *   `SUCCESS`: "Trade Filled: NVDA Call @ $2.50" (Toast Popup).
    *   `CRITICAL`: "Emergency: Schwab API Down" (SMS/PagerDuty/Discord).

### 📜 Audit Log (Compliance) **[T2]**
*   **What:** A strictly append-only table `system_audit_log`.
*   **Records:** User Login, Strategy Parameter Changes, Manual Overrides.
*   **Why:** If money goes missing, distinct proof whether it was Bot Logic or User Manual Action.

---

## 8. Implementation Details

#### A. Database Schema for State
We need specific columns to track the "Brain" of the bot.

**Table: `active_bots`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `bot_id` | UUID | Unique Bot ID. |
| `status` | Enum | `RUNNING`, `PAUSED`, `CRASHED_RECOVERING`. |
| `current_step` | String | `WAITING_FOR_ENTRY`, `PLACING_LEG_1`, `MONITORING_PROFIT`. |
| `memory_dump` | JSONB | Snapshot of variables (e.g., `{ "entry_price": 100.50, "stop_loss": 95.00 }`). |
| `last_heartbeat` | Timestamp | Used to detect if a bot process has frozen/died. |

**Table: `execution_queue`** (The Air Gap)
| Column | Type | Description |
| :--- | :--- | :--- |
| `intent_id` | UUID | Idempotency Key. |
| `account_id` | String | Which isolated executor handles this. |
| `status` | Enum | `QUEUED`, `SENT_TO_BROKER`, `ACKNOWLEDGED`, `FILLED`. |
| `broker_ref_id` | String | The ID Schwab gave us back. |

---

#### B. The "Crash Scenario" Walkthrough

Let's walk through an **Iron Condor Strategy** getting interrupted by a power outage.

**Phase 1: The Attempt**
1.  **Bot** decides to open an Iron Condor.
2.  **Bot** generates `intent_id = "abc-123"`. Saves to DB: `Step = PLACING_ORDER`.
3.  **Bot** pushes message to RabbitMQ `queue.account_A`.
4.  **Executor A** picks up message.
5.  **Executor A** sends HTTP POST to Schwab.
6.  **💥 SERVER CRASH (Power Failure) 💥**

*Result: We don't know if Schwab got it. The DB says "PLACING_ORDER". RabbitMQ might have re-queued the message or lost it depending on config.*

**Phase 2: The Recovery (Auto-Pilot)**
1.  **Server Restarts.**
2.  **Reconciliation Worker** starts first.
    *   It pulls "Open Orders" from Schwab.
    *   It checks against `execution_queue`.
    *   *Case A (Schwab got it):* It sees `client_id="abc-123"` in the Schwab list. It updates our DB status to `SENT_TO_BROKER`.
    *   *Case B (Schwab didn't get it):* It sees the ID is missing. It marks the DB status as `FAILED_SEND`.
3.  **Bot Manager** starts.
    *   It scans `active_bots` for status `RUNNING`.
    *   It sees our Iron Condor bot was `PLACING_ORDER`.
    *   It re-initializes the bot class and injects the `memory_dump` (restoring variables).
    *   The Bot checks the `execution_queue` for `abc-123`.
        *   If `SENT_TO_BROKER`: The Bot transitions to `WAITING_FOR_FILL`. **(Zero duplicate orders)**.
        *   If `FAILED_SEND`: The Bot re-submits the order to the queue.

---

#### C. The "Executor" Design for Lag/Timeouts

We isolate the accounts, but we also wrap them in **Circuit Breakers**.

```python
# Pseudo-code for the Isolated Executor
class AccountExecutor:
    def process_queue(self):
        while True:
            order = queue.get()
            
            try:
                # 1. Check if we already did this (Local Dedup)
                if db.check_exists(order.id):
                    continue

                # 2. Try to execute with Retry Logic (Tenacity)
                response = self.send_to_schwab(order)
                
                # 3. Success
                db.update_status(order.id, "SENT", response.broker_id)

            except NetworkTimeout:
                # 4. AMBIGUOUS STATE - The scariest state
                # We don't know if it went through.
                # DO NOT RETRY IMMEDIATELY.
                
                # Action: Trigger an immediate "Flash Reconciliation"
                found_order = self.check_schwab_for_id(order.id)
                
                if found_order:
                    db.update_status(order.id, "SENT", found_order.id)
                else:
                    # Safe to retry now
                    self.retry(order)

            except RateLimitError:
                # 5. Backoff
                time.sleep(5)
                queue.put_front(order) # Put back in queue
```

### Summary of Resilience Features

1.  **DBOS/Postgres:** Acts as the "Save Game" file. We never run strictly in RAM.
2.  **UUIDs:** The fingerprint for every order, preventing duplicates.
3.  **Reconciliation Worker:** The audit system that runs on startup to align Local Reality with Broker Reality.
4.  **Flash Sync:** If a network timeout occurs, we check order status *before* retrying.
---

## 9. Visual Architecture Maps

### High-Level Flow (Integrated Safety)

```text
                                  USER DASHBOARD [T1]
                               (Start Bot / View PnL)
                                         |
+---------------------------------------------------------------------------------+
|                            API GATEWAY (FastAPI) [T1]                           |
|                    (Auth Check: User Can Access Account?)                       |
+---------------------------------------------------------------------------------+
         |                               |                                |
         v                               v                                v
+----------------+              +-----------------+              +----------------+
| 🤖 BOT MANAGER |              | 👁️ DATA FACADE |              | 📜 AUDIT LOG   |
| (Prefect/DBOS) |              | (Polars) [T1]   |              | (Postgres) [T2]|
|      [T1]      |              +-----------------+              +----------------+
+----------------+                       |                       ^ (Records Action)
| - State Machine|              (Get Live Price/Greeks)          |
| - Recovery     |                       |                       |
+----------------+                       v                       |
         | (Order Intent: "Buy SPY")                             |
         v                                                       |
+------------------------------------------------------+         |
| 🛡️ RISK MANAGER MIDDLEWARE [T1]                      |---------+ (Records Breach)
| 1. Check Daily PnL vs Limit ($500)                   |
| 2. Check Max Position Size                           |
| -> REJECT if violation / PASS if safe                |
+------------------------------------------------------+
         | (Verified Intent)
         v
+---------------------------------------------------------------------------------+
|                       ⚡ SMART EXECUTION ROUTER [T2]                            |
|           (Routes Intent to Specific RabbitMQ Topic based on Acct ID)           |
+---------------------------------------------------------------------------------+
         |                                                |
         | Queue: queue.acct_A (Cash)                     | Queue: queue.acct_B (Margin)
         v                                                v
+-----------------------------------------+      +-----------------------------------------+
| 🔒 EXECUTOR VAULT: ACCOUNT A [T2]       |      | 🔒 EXECUTOR VAULT: ACCOUNT B [T2]       |
| (Isolated Worker Process)               |      | (Isolated Worker Process)               |
+-----------------------------------------+      +-----------------------------------------+
| [ Session Manager (Creds A) ]           |      | [ Session Manager (Creds B) ]           |
| [ Algo: Smart Limit Walker ]            |      | [ Algo: Stop Loss Chaser ]              |
+-----------------------------------------+      +-----------------------------------------+
         | (Executes via API)                             |
         v                                                v
+-----------------------+                        +-----------------------+
| 🏛️ SCHWAB API (A)    |                        | 🔔 NOTIFICATION HUB   |
+-----------------------+                        | [T2] (Event Listener) |
                                                 +-----------------------+
                                                 | -> 📱 SMS (Critical)  |
                                                 | -> 🖥️ UI (Toast)      |
                                                 +-----------------------+
```

### Crash Recovery Flow (State Focus)

```text
+---------+       +---------+       +-----------+
| 🤖 BOT  | ----> | 🐘 DB   | ----> | 🛑 CRASH! |
+---------+       +---------+       +-----------+
     |                 |
(1) Calc Entry    (2) Commit:
                  "State=SENDING"
                  "UUID=abc-123"

       ---------------- (Time Passes / Reboot) ----------------

+---------+       +---------+       +-------------------+
| 👷 RECON| <---- | 🏛️ API  | <---- | 💾 CHECK DB       |
| WORKER  |       | SCHWAB  |       | "UUID=abc-123?"   |
+---------+       +---------+       +-------------------+
     |                 |                       ^
(3) Start Up      (4) Get Orders               |
     |            (5) "abc-123" exists?        |
     |                 |                       |
     +-----------------+                       |
             |                                 |
    (6) IF EXISTS: Update DB "State=FILLED" ---+
    (7) IF MISSING: Update DB "State=FAILED" --+

+---------+
| 🤖 BOT  | <--- (8) Restart & Read DB
+---------+
     |
(9) See "State=FILLED" -> Skip Execution -> Move to "Manage Position"
```

## 10. Monorepo Folder Structure

```
. (root)
├── pyproject.toml           # Root uv workspace config
├── package.json             # Monorepo management (Turbo/Nx)
├── uv.lock                  # Global lockfile
├── .env.local               # Local dev environment (not committed)
│
├── apps/
│   ├── api/                 # <--- YOUR PYTHON BACKEND (FastAPI)
│   │   ├── main.py          # FastAPI Entrypoint
│   │   ├── Makefile         # Dev commands (make dev, make test)
│   │   │
│   │   ├── core/            # Config, Security, Logging
│   │   │   ├── config.py    # Pydantic Settings (env vars)
│   │   │   └── security.py  # JWT, password hashing
│   │   │
│   │   ├── db/              # Database layer (Psycopg3 + SQLAlchemy hybrid)
│   │   │   ├── adapters/    # Database adapter pattern
│   │   │   │   ├── __init__.py       # Adapter exports
│   │   │   │   ├── base.py           # Abstract DatabaseAdapter
│   │   │   │   └── postgresql.py     # PostgreSQL adapter (psycopg3)
│   │   │   ├── migrations/  # PostgreSQL migration scripts (auto-applied)
│   │   │   │   ├── 001_options_screener_postgresql.sql
│   │   │   │   └── ...               # Numbered SQL files
│   │   │   ├── migration_runner.py   # Auto-applies migrations on startup
│   │   │   ├── manager.py   # DatabaseManager (singleton, Db + DbSession)
│   │   │   └── database.py  # SQLAlchemy Base class
│   │   │
│   │   ├── models/          # SQLAlchemy ORM models
│   │   │   └── models.py    # User, Item, BotRun, etc.
│   │   │
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   │   └── schemas.py   # UserCreate, ItemResponse, etc.
│   │   │
│   │   ├── routes/          # API routes
│   │   │   ├── dependencies.py  # Dependency injection (DB, Auth)
│   │   │   └── v1/          # API version 1
│   │   │       ├── __init__.py  # Combine all routers
│   │   │       └── endpoints/   # Route handlers
│   │   │           ├── auth.py
│   │   │           ├── users.py
│   │   │           ├── items.py
│   │   │           ├── health.py
│   │   │           └── settings.py  # ✅ NEW: Runtime config API
│   │   │
│   │   ├── utils/           # ✅ NEW: Utility modules
│   │   │   ├── __init__.py  # Utils exports
│   │   │   └── timekeeper.py  # Whenever timezone-aware datetime utilities
│   │   │
│   │   ├── services/        # Business logic layer
│   │   │   ├── broker/      # Broker adapters
│   │   │   │   └── schwab_adapter.py  # Schwab API client
│   │   │   ├── broker_auth/ # Broker authentication (Schwab OAuth)
│   │   │   │   ├── auth_manager.py    # Auth flow manager
│   │   │   │   ├── auth_workflow.py   # Workflow orchestration
│   │   │   │   ├── flow_store.py      # Token persistence
│   │   │   │   └── settings.py        # Auth settings
│   │   │   ├── finviz/      # ✅ MIGRATED: Finviz screener (psycopg3)
│   │   │   │   └── screener/
│   │   │   │       └── options/
│   │   │   │           └── tickers/
│   │   │   │               ├── repository.py     # ✅ NEW: Psycopg3 repository
│   │   │   │               ├── ticker_manager.py # ✅ MIGRATED: Uses DatabaseManager
│   │   │   │               ├── models.py         # Data models
│   │   │   │               ├── schemas.py        # Pydantic schemas
│   │   │   │               └── router.py         # API endpoints
│   │   │   ├── optionstrat/ # ✅ NEW: OptionStrat integration
│   │   │   │   ├── strategy/        # Strategy-specific functionality
│   │   │   │   │   ├── client.py    # API client (fetch & decrypt)
│   │   │   │   │   ├── parser.py    # Parse strategy data
│   │   │   │   │   ├── manager.py   # Business logic orchestration
│   │   │   │   │   ├── repository.py # Database CRUD (psycopg3)
│   │   │   │   │   ├── schemas.py   # Request/response schemas
│   │   │   │   │   └── router.py    # FastAPI endpoints
│   │   │   │   ├── scheduler.py     # Snapshot scheduler bot
│   │   │   │   ├── models.py        # Pydantic database models
│   │   │   │   └── utils.py         # Helper functions
│   │   │   ├── market_data/ # Market data abstraction (future)
│   │   │   │   ├── base.py  # IMarketDataProvider interface
│   │   │   │   ├── schwab.py    # Schwab adapter
│   │   │   │   ├── orats.py     # ORATS adapter
│   │   │   │   └── polygon.py   # Polygon adapter
│   │   │   ├── execution/   # Order execution services (future)
│   │   │   │   ├── router.py    # Smart order router
│   │   │   │   └── executor.py  # Account-isolated executors
│   │   │   └── risk/        # Risk management (future)
│   │   │       └── manager.py   # Kill switch, position limits
│   │   │
│   │   ├── workflows/       # Durable workflows (future)
│   │   │   ├── temporal/    # Temporal workflows
│   │   │   │   └── trade_lifecycle.py
│   │   │   └── prefect/     # Prefect flows
│   │   │       └── data_refresh.py
│   │   │
│   │   └── bot/             # Bot modules (domain-specific)
│   │       └── earnings_edge/   # Calendar spread screener
│   │           ├── engine.py    # Core screening logic
│   │           ├── providers.py # ORATS/Yahoo data adapters
│   │           ├── models.py    # BotRun, ScreenerResult models
│   │           ├── schemas.py   # Request/response schemas
│   │           ├── service.py   # Async service layer
│   │           ├── scheduler.py # APScheduler jobs
│   │           └── router.py    # Bot API endpoints
│   │
│   └── tests/               # Pytest test suite (184 passed, 4 skipped)
│       ├── conftest.py      # Global test fixtures
│       ├── api/             # Tests for api/ modules
│       │   ├── db/          # ✅ NEW: Database layer tests (55+ tests)
│       │   │   ├── test_adapters.py    # PostgreSQL adapter tests
│       │   │   └── test_manager.py     # DatabaseManager tests
│       │   └── utils/       # ✅ NEW: Utility tests
│       │       └── test_timekeeper.py    # Whenever datetime tests (60+ tests)
│       ├── services/        # Tests for services/
│       │   ├── broker/      # Tests for broker adapters
│       │   │   └── test_schwab_adapter.py
│       │   ├── broker_auth/ # Tests for broker_auth service
│       │   │   ├── test_auth_manager.py
│       │   │   ├── test_auth_workflow.py
│       │   │   ├── test_flow_store.py
│       │   │   └── test_settings.py
│       │   └── finviz/      # ✅ NEW: Finviz screener tests
│       │       └── screener/
│       │           └── options/
│       │               └── tickers/
│       │                   ├── test_repository.py      # Repository tests (20+ tests)
│       │                   ├── test_ticker_manager.py  # Manager tests
│       │                   └── test_options_export.py  # Excel export tests
│       ├── core/            # Tests for core/
│       │   └── test_config.py
│       ├── models/          # Tests for models/
│       │   └── test_models.py
│       ├── routes/          # Tests for routes/
│       │   └── v1/
│       │       └── test_endpoints.py
│       └── bot/             # Tests for bot/
│           └── earnings_edge/
│               ├── test_engine.py
│               ├── test_providers.py
│               └── test_service.py
│
├── web/                     # <--- YOUR FRONTEND (TanStack Start)
│   ├── app/
│   │   ├── routes/          # File-based routing
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities, API clients
│   ├── public/              # Static assets
│   └── package.json
│
├── packages/                # SHARED ASSETS (optional future)
│   ├── shared-types/        # Generated TS types from Pydantic
│   ├── ui/                  # shadcn/ui components library
│   └── config/              # Shared Tailwind/ESLint configs
│
├── static/                  # Current frontend assets (legacy)
├── templates/               # Jinja2 templates (if using SSR)
│
├── docs/                    # Documentation
│   ├── api/                 # Backend API docs (MkDocs)
│   ├── web/                 # Frontend docs (future)
│   ├── Future Features/     # ✅ NEW: Future implementation plans
│   │   └── db_transactions.md  # Transaction support roadmap
│   ├── Architecture.md      # This file (Master plan)
│   ├── RUNTIME_CONFIG.md    # ✅ NEW: Runtime configuration API guide
│   ├── PSYCOPG3_MIGRATION_PLAN.md      # ✅ Migration strategy
│   ├── PSYCOPG3_MIGRATION_COMPLETE.md  # ✅ Phase 1 completion report
│   └── OPTIONSTRAT_INTEGRATION.md      # ✅ NEW: OptionStrat strategy tracking
│
├── .github/
│   └── workflows/           # CI/CD pipelines (GitHub Actions)
│       ├── ci.yml           # Lint, test, security scans
│       ├── docs.yml         # Deploy docs to GitHub Pages
│       └── release.yml      # Release workflow
│
├── .pre-commit-config.yaml  # Pre-commit hooks (ruff, ty)
├── .dockerignore            # Docker build exclusions
│
├── Dockerfile               # Multi-stage build for apps/api
├── Makefile                 # Root commands (install, dev, test)
└── README.md                # Project overview
```

### Current State vs Future State

**Current (MVP):**
- `apps/api/` - FastAPI backend with:
  - ✅ **Core Modules**:
    - `core/config.py` - Pydantic settings with runtime override support
    - `core/security.py` - JWT authentication
  - ✅ **Database Layer** (PostgreSQL only, hybrid raw SQL + ORM):
    - `db/adapters/` - PostgreSQL adapter (psycopg3)
    - `db/manager.py` - Singleton manager (Db + DbSession dependencies)
    - `db/migration_runner.py` - Auto-applies numbered SQL migrations
    - `db/migrations/` - PostgreSQL migration scripts
    - `utils/timekeeper.py` - Whenever timezone-aware utilities
  - ✅ **API Routes**:
    - `routes/v1/endpoints/auth.py` - Authentication
    - `routes/v1/endpoints/users.py` - User management
    - `routes/v1/endpoints/items.py` - CRUD example
    - `routes/v1/endpoints/health.py` - Health checks
    - `routes/v1/endpoints/settings.py` - **NEW: Runtime configuration API**
  - ✅ **Services**:
    - `services/broker/schwab_adapter.py` - Schwab API client
    - `services/broker_auth/` - Schwab OAuth flow (auth manager, workflow, token storage)
    - `services/finviz/screener/options/` - Options screener with:
      - `repository.py` - **NEW: Psycopg3 repository pattern**
      - `ticker_manager.py` - **MIGRATED: Uses DatabaseManager**
  - ✅ **Bots**:
    - `bot/earnings_edge/` - Calendar spread screener (SQLAlchemy, pending migration)
- `apps/tests/` - **184 passing tests, 4 skipped**
  - **Unit Tests** (pytest + unittest framework):
    - `tests/api/db/test_adapters.py` - Database adapter tests (25+ tests)
    - `tests/api/db/test_manager.py` - DatabaseManager tests (15+ tests)
    - `tests/api/utils/test_timekeeper.py` - Whenever datetime tests (60+ tests)
    - `tests/services/broker/` - Broker adapter tests
    - `tests/services/broker_auth/` - OAuth flow tests
    - `tests/services/finviz/screener/options/tickers/` - Screener tests
  - **Note:** Test structure mirrors `api/` directory layout
- `static/` - Simple HTML/CSS/JS frontend
- `templates/` - Jinja2 templates for auth pages

**Key Recent Additions:**
- ✅ **DynamicSettings**: DB-backed runtime config with API, audit trail, `.env.local` override
- ✅ **Hybrid DB Architecture**: PostgreSQL-only — raw SQL (psycopg3) + ORM (SQLAlchemy)
- ✅ **Migration Runner**: Auto-applies numbered PostgreSQL migrations on startup
- ✅ **Pipeline State in DB**: `pipeline_state` table replaces JSON file, crash recovery
- ✅ **Whenever Integration**: Modern timezone-aware datetime handling

**Next Phase (Additional Services):**
- `apps/api/services/` - Expand service layer:
  - `optionstrat/` - **PLANNED: OptionStrat integration**
    - Strategy snapshot tracking
    - Scheduled captures (pre-trade, post-trade)
    - Historical timeline view
    - Strategy embedding/visualization
    - See: [OPTIONSTRAT_INTEGRATION.md](OPTIONSTRAT_INTEGRATION.md)
  - `market_data/` - Unified interface for Schwab/ORATS/Polygon
  - `execution/` - Smart order router + account executors
  - `risk/` - Kill switch and position limits

**Future (Full Stack + Workflows):**
- `apps/api/workflows/` - Durable execution:
  - `temporal/` - Trade lifecycle workflows (Order → Fill → Exit)
  - `prefect/` - Data pipelines (Greeks refresh, backtests)
- `web/` - TanStack Start app replaces `static/`
- `packages/` - Shared TypeScript types and UI components