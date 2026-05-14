# TESTx

TESTx is a crowdsourcing evaluation platform where registered evaluators rate and compare media files (photos, videos, audio, text) through structured tests. Admins create tests, define targeting criteria, and analyze aggregated results with demographic breakdowns. The platform enforces quality control through speed checks, attention-check questions, and consistency traps.

---

## Architecture Overview

TESTx is a **TypeScript monorepo** managed with [Turborepo](https://turbo.build) and [pnpm workspaces](https://pnpm.io/workspaces).

```
testx/
├── apps/
│   ├── evaluator/      # Next.js — evaluator-facing app       (port 3000)
│   ├── admin/          # Next.js — admin panel                (port 3001)
│   └── api/            # Fastify — REST API                   (port 4000)
├── packages/
│   ├── database/       # Prisma schema, migrations, seed
│   ├── shared/         # Shared TypeScript types, Zod schemas, constants
│   ├── ui/             # Shared shadcn/ui component library
│   └── config/         # Shared ESLint, Prettier, Tailwind, tsconfig
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Apps

| App | Tech | Description |
|-----|------|-------------|
| `apps/evaluator` | Next.js 16 (App Router) | Self-service portal for evaluators: registration, onboarding, test-taking, balance view |
| `apps/admin` | Next.js 16 (App Router) | Admin panel: test creation, media library, results & analytics, user management |
| `apps/api` | Fastify 5 | REST API consumed by both frontends; handles auth, business logic, media proxy |

### Packages

| Package | Description |
|---------|-------------|
| `packages/database` | Prisma schema and client for PostgreSQL; migration history; seed script |
| `packages/shared` | Zod validation schemas, TypeScript types, reward calculation logic, shared constants |
| `packages/ui` | Reusable React components (Button, Card, Input, Dialog, Table, etc.) built on Tailwind CSS |
| `packages/config` | Shared ESLint config, Prettier config, Tailwind preset, and TypeScript base configs |

### API Route Groups

| Prefix | Access | Purpose |
|--------|--------|---------|
| `GET /health` | Public | Health check |
| `POST /auth/*` | Public | Registration, login, logout, token refresh, Google OAuth |
| `GET /auth/me` | Authenticated | Current user profile |
| `GET/POST /evaluator/*` | Evaluator role | Next-test assignment, test-taking, answer submission, balance |
| `GET /media/:id/file` | Public | Media proxy (serves uploaded files and Google Drive-cached files) |
| `GET/POST/PUT/DELETE /admin/*` | Admin role | Dashboard stats, test CRUD, question CRUD, media library, user list, templates |

### Database Schema (key entities)

`User` → `EvaluatorProfile` (demographics + reward balance)

`Test` → `Question` → `QuestionOption` → `Media`

`TestResponse` (per evaluator per test, with flagging logic) → `Answer` (per question)

`Template` (system-provided test skeletons)

---

## Prerequisites

- **Node.js** 20+
- **pnpm** 10+ — install with `npm install -g pnpm`
- **PostgreSQL** 15+ running locally (or via Docker)

---

## Local Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd TESTx
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and update as needed:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/testx?schema=public"

# Fastify API server
API_HOST="0.0.0.0"
API_PORT="4000"

# Frontend origins (used by CORS and OAuth redirects)
EVALUATOR_APP_URL="http://localhost:3000"
ADMIN_APP_URL="http://localhost:3001"

# Used by both Next.js apps to reach the API
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

The `.env` file must be present in the **repo root** — the API and database packages resolve it from there.

> **Google OAuth (optional for local dev):** To enable "Sign in with Google", add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env` and configure an OAuth 2.0 credential in the [Google Cloud Console](https://console.cloud.google.com/) with `http://localhost:4000/auth/google/callback` as the redirect URI.
>
> **Google Drive import (optional):** To enable Drive folder imports in the media library, add `GOOGLE_SERVICE_ACCOUNT_KEY` (base64-encoded service account JSON) to `.env`.

### 4. Set up the database

Make sure PostgreSQL is running and the `testx` database exists:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE testx;"
```

Run migrations to create all tables:

```bash
pnpm db:migrate
```

Seed the database with an admin user, sample evaluators, tests, media, and demo responses:

```bash
pnpm db:seed
```

The seed script creates:
- 1 admin account (`admin@testx.com` / `admin123`)
- Several sample evaluator accounts
- Sample tests in various statuses with questions and responses

### 5. Start the development servers

```bash
pnpm dev
```

Turborepo starts all three apps in parallel:

| Service | URL |
|---------|-----|
| Evaluator App | http://localhost:3000 |
| Admin App | http://localhost:3001 |
| Fastify API | http://localhost:4000 |

---

## Other Useful Commands

```bash
# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Format all files with Prettier
pnpm format

# Build all apps for production
pnpm build

# Regenerate Prisma client after schema changes
pnpm db:generate

# Create a new migration after editing schema.prisma
pnpm db:migrate
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 16 (App Router), React 19 |
| UI Components | shadcn/ui + Tailwind CSS 3 |
| Backend | Fastify 5 |
| ORM | Prisma 6 |
| Database | PostgreSQL 15 |
| Auth | JWT (httpOnly cookies) + Google OAuth |
| Validation | Zod |
| Language | TypeScript 5 (strict mode, full stack) |
| Media Source | Google Drive API (backend proxy with file cache) |
