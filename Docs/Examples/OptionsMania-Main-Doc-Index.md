# OptionsMania — Documentation Index

> Main reference index for all active documentation in this repo.

---

## 🤖 AI Development — Read Before Starting Any Work

| Doc | Purpose |
|-----|---------|
| [AI-Development-Guide.md](AI-Development-Guide.md) | **Start here** — rules and patterns for AI assistants: DB access, time handling, auth, pipeline, error handling. Follow and update alongside Architecture. |
| [Architecture.md](Architecture.md) | System architecture — tech stack, air gap pattern, account sharding, state-first design, infrastructure overview |
| [Feature-Template.md](Feature-Template.md) | Required template for documenting any new feature built |
| [api/Realtime-Data-Pipeline.md](api/Realtime-Data-Pipeline.md) | **Read if touching data/DB** — real-time market data pipeline, Redis, PostgreSQL, WebSocket broadcasting |

---

## 🚀 Development Setup

| Doc | Purpose |
|-----|---------|
| [Development/Local-Dev-Quickstart.md](Development/Local-Dev-Quickstart.md) | Local dev setup using uv package manager |
| [Development/Package-Manager-UV.md](Development/Package-Manager-UV.md) | uv as a fast Python package manager (replaces pip/venv) |

### AI Tooling

| Doc | Purpose |
|-----|---------|
| [Development/AI-Tooling/Slash-Commands.md](Development/AI-Tooling/Slash-Commands.md) | **Claude Code slash commands** — scaffolding system for endpoints, bots, pipelines, UI components, widgets, pages. Includes subagent workflow patterns for parallel builds and architecture reviews |
| [Development/AI-Tooling/Claude - Auto-Commit.md](Development/AI-Tooling/Claude%20-%20Auto-Commit.md) | Auto-commit hook for Claude Code sessions |

### IDE

| Doc | Purpose |
|-----|---------|
| [Development/IDE/VsCode-Setup.md](Development/IDE/VsCode-Setup.md) | VS Code config — prerequisites, project structure, dev workflow |
| [Development/IDE/VsCode-Launch-vs-Tasks.md](Development/IDE/VsCode-Launch-vs-Tasks.md) | launch.json (debugging) vs tasks.json (automation) — when to use which |
| [Development/IDE/Useful-Tools.md](Development/IDE/Useful-Tools.md) | Recommended VS Code extensions |

### Environment

| Doc | Purpose |
|-----|---------|
| [Development/Environment/Environment-Setup.md](Development/Environment/Environment-Setup.md) | **Three-tier env system** — `.env.local`, `docker.env`, `docker.prod.env`, admin endpoints, port architecture |
| [Development/Environment/Port-Config.md](Development/Environment/Port-Config.md) | Port config — backend 8200, frontend 3000 |
| [Development/Environment/Runtime-Config.md](Development/Environment/Runtime-Config.md) | Runtime config system — dynamic settings without restart, frontend env vars |

### Testing

| Doc | Purpose |
|-----|---------|
| [Development/Testing/Testing.md](Development/Testing/Testing.md) | Backend (pytest) and frontend (Vitest) testing guide with coverage goals |

---

## 🏗️ API & Database

| Doc | Purpose |
|-----|---------|
| [api/Database-Architecture.md](api/Database-Architecture.md) | Hybrid DB — raw SQL via psycopg3 (performance) + SQLAlchemy ORM (relationships), PostgreSQL only |
| [api/Database-Migrations.md](api/Database-Migrations.md) | **Read if touching DB schema** — how to create/update migrations, migration runner, checklist for DB changes |
| [Dynamic-Settings.md](Dynamic-Settings.md) | DB-backed runtime config — `app_settings` table, API endpoints, audit trail, `.env` override system |
| [api/Time.md](api/Time.md) | All datetime handling — `whenever` library, UTC storage, timezone conversions, DST, TIMESTAMPTZ |
| [api/Symbol-Search-System.md](api/Symbol-Search-System.md) | Symbol search — SEC EDGAR master list, Yahoo Finance fallback, Redis caching, frontend instant search |
| [api/API-Reference.md](api/API-Reference.md) | **Interactive API docs** — Scalar at `/scalar`, Swagger at `/docs`, OpenAPI spec reference |

---

## 🔐 Authentication & Broker Integration

| Doc | Purpose |
|-----|---------|
| [web/auth/Auth.md](web/auth/Auth.md) | Web auth flow — better-auth, account tiers, OAuth providers, session management |
| [in-progress/Chris/Session-Timeout-System.md](in-progress/Chris/Session-Timeout-System.md) | **Session timeout & idle lock** — three-timer state machine, PIN unlock, half-auth read-only state, WebSocket auth |
| [web/auth/Sharing.md](web/auth/Sharing.md) | Multi-tenancy and sharing — user isolation, visibility models, share permissions |
| [api/broker_auth/Auth-Manager.md](api/broker_auth/Auth-Manager.md) | Brokerage OAuth2 — durable workflows with DBOS, token lifecycle, crash recovery (Schwab) |
| [api/Schwab-API-Sandbox.md](api/Schwab-API-Sandbox.md) | **Schwab sandbox mode** — dev/production API switching, Prism mock setup, safety design |
| [in-progress/Chris/Schwab-Account-Data-System.md](in-progress/Chris/Schwab-Account-Data-System.md) | **Schwab account data sync** — balances, positions, orders, transactions sync workers, spread detection, 7 frontend components |

---

## 🖥️ Frontend

| Doc | Purpose |
|-----|---------|
| [web/menu-help.md](web/menu-help.md) | Help menu philosophy — keyboard shortcuts, zoom system, layout customization, developer logs documentation |
| [web/Cross-Device-Settings-Architecture.md](web/Cross-Device-Settings-Architecture.md) | **Cross-device settings sync** (Phases 1-5 ✅) — device fingerprinting, per-device layouts, server-side persistence, auto-identify, device management UI, settings resolution chain, localStorage migration, heartbeat, layout device profiles UI. [Implementation tracker](in-progress/Chris/Cross-Device-Settings-Implementation.md) |
| [web/Page-Scroll-Overshoot.md](web/Page-Scroll-Overshoot.md) | Global page scroll overshoot — 50vh bottom padding on all dashboard pages so the last widget can scroll to the top of the viewport. Uses `data-dashboard-content` scoping + `.page-scroll` class. |

---

## ☁️ Replit Sync

| Doc | Purpose |
|-----|---------|
| [web/Replit/Replit-Sync.md](web/Replit/Replit-Sync.md) | Pull Replit changes **back locally** using sync script |
| [web/Replit/Replit-LocalChanges.md](web/Replit/Replit-LocalChanges.md) | Push local changes **to** Replit (git loop, SSH sync, rsync) |
| [web/Replit/Replit-SSH.md](web/Replit/Replit-SSH.md) | SSH and Git identity setup for Replit and local machines |

---

> **Archive:** Completed phase docs, superseded decisions, and resolved TODOs are in [`docs/~Archive/`](~Archive/).
