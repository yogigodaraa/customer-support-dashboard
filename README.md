# WeSupport

A unified customer support dashboard that consolidates **Luciq** (bugs), **Intercom** (messaging), **Front** (team email), and **Retool** (user management) into a single searchable view.

## What it does

Instead of tab-hopping across four tools to piece together a single customer's history, WeSupport pulls everything by email or user ID into one place:

- Unified search across all connected platforms
- Centralized dashboard with open bugs, conversations, and tickets per user
- Automatic background sync every 5 minutes
- Intelligent caching for faster repeat lookups
- Real-time WebSocket updates
- Integration status monitoring

## Tech stack

Yarn workspace monorepo.

**Frontend** (`frontend/`) — Next.js 14 + React 18 + TypeScript
**Backend** (`backend/`) — Express.js + TypeScript + Prisma ORM + PostgreSQL
**Auth** — OAuth with each integrated provider

## Getting started

```bash
yarn install
yarn dev        # runs frontend (3000) + backend (3001) concurrently
```

Copy `.env.example` to `.env` in both `frontend/` and `backend/` and fill in:

- `LUCIQ_API_KEY`
- `INTERCOM_ACCESS_TOKEN`
- `FRONT_API_KEY`
- `RETOOL_API_KEY`
- `DATABASE_URL` (backend)

See `API_SETUP_GUIDE.md` for step-by-step provider setup.

## Project structure

```
frontend/       Next.js dashboard (App Router)
backend/        Express API + Prisma + OAuth integrations
setup.sh        Bootstrap script
docs/           Build summary, file structure, user guide
```

## Status

Active development. Internal tool. Build details in `BUILD_SUMMARY.md`.
