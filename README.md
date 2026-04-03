# FinTrack

Full-stack personal finance tracker: **React + Vite + Tailwind**, **Express + Prisma + PostgreSQL**, JWT auth, multi-account balances, categorized transactions, budgets with alerts, rule-based auto-categorization, analytics, and insight summaries.

## Structure

```
fintrack/
├── apps/
│   ├── api/          # Express (TypeScript), Prisma, REST
│   └── web/          # React 19, TanStack Query, Recharts, Framer Motion
├── database/
│   └── schema.sql    # Reference SQL (Prisma is source of truth for migrations)
├── docker-compose.yml
└── package.json      # npm workspaces
```

## Prerequisites

- Node.js 20+
- PostgreSQL (local Docker, Neon, or Supabase)

## Setup

1. **Database** — from repo root:

   ```bash
   docker compose up -d
   ```

2. **Environment** — copy `apps/api/.env.example` to `apps/api/.env` and set at least:

   - `DATABASE_URL` — e.g. `postgresql://fintrack:fintrack@localhost:5432/fintrack`
   - `JWT_SECRET` — long random string (16+ chars)
   - `CORS_ORIGIN` — `http://localhost:5173` for local web

3. **Install & schema**

   ```bash
   npm install
   npm run db:push
   ```

   (`db:push` syncs the Prisma schema; use `db:migrate` when you want versioned migrations.)

4. **Run**

   ```bash
   npm run dev
   ```

   - API: `http://localhost:4000` (health: `GET /health`)
   - Web: `http://localhost:5173` (proxies `/api` to the API in dev)

   Or run `npm run dev:api` and `npm run dev:web` in two terminals.

5. **Production web** — set `VITE_API_URL` to your public API URL (no trailing slash). Leaving it empty uses same-origin `/api` (configure your CDN/host to proxy API or use CORS).

## Scripts

| Command        | Description                |
|----------------|----------------------------|
| `npm run dev`  | API + web (concurrently)   |
| `npm run build`| Build API and web          |
| `npm run test` | API unit tests (Vitest)    |
| `npm run db:push` | Prisma push to DB      |
| `npm run db:generate` | Regenerate Prisma client |

## API overview

| Prefix | Purpose |
|--------|---------|
| `POST /api/auth/register` · `login` · `GET /api/auth/me` | Auth (Bearer JWT) |
| `/api/accounts` | Accounts CRUD |
| `/api/categories` | Categories |
| `/api/categorization-rules` | Keyword → category rules |
| `/api/transactions` | List (filters, pagination), create, patch, delete |
| `/api/budgets` | Monthly category budgets |
| `/api/analytics/summary` · `/trend` | Dashboard data |
| `GET /api/insights` | Rule-based spending insights |
| `/api/notifications` | Budget alerts |
| `/api/savings-goals` | Goals |

## Deploy

- **Web (Vercel):** app directory `apps/web`, build `npm run build`, output `dist`, env `VITE_API_URL`.
- **API (Render / Railway):** root `apps/api`, build `npm install && npm run build`, start `npm run start`, set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`.
- **DB:** Neon / Supabase connection string with SSL.

## Stack notes

- Amounts: `Decimal` in DB; JSON returns numbers — for strict currency consider string cents in API v2.
- JWT is sent in `Authorization: Bearer` header; moving to httpOnly refresh cookies is a natural hardening step.
- Recurring transactions are modeled (`recurrence` enum); expansion via cron/worker is not included in this scaffold.

## License

MIT
