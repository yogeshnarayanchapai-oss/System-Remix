# SocialBoxx

A full-stack Facebook social media management platform. Manage Facebook pages, inbox conversations, leads, automation rules, reports, and team settings from one command center.

## Run & Operate

- `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/socialboxx run dev` — run the frontend dev server (port 5000)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui, wouter, TanStack Query
- API: Express 5, JWT auth
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod, drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/socialboxx/` — React+Vite frontend
- `artifacts/socialboxx/src/pages/` — all page components (auth, dashboard, pages, inbox, leads, automation, reports, settings, admin)
- `artifacts/socialboxx/src/hooks/use-auth.tsx` — JWT auth context
- `artifacts/api-server/src/routes/` — all Express route handlers
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/db/src/schema/` — Drizzle ORM schema (source of truth for DB)
- `lib/api-client-react/` — generated React Query hooks + Zod schemas

## Architecture decisions

- JWT tokens stored in localStorage as `sb_token`; auth middleware reads `Authorization: Bearer <token>` header
- OpenAPI-first: spec gates codegen, which gates the frontend; always run codegen after changing the spec
- All API routes served under `/api` prefix via reverse proxy
- Frontend dev server uses Node.js HTTP server wrapping Vite middleware (`dev.mjs`) bound to `::` (IPv6 dual-stack) on port 5000
- The "SocialBoxx App" workflow bypasses the artifact-managed workflow's broken port detection; use it instead of the artifact workflow

## Product

- **Auth**: JWT login/register, email-based, roles (admin/member/pending/rejected)
- **Dashboard**: KPI cards, recent conversations, quick stats
- **Pages**: Facebook page management (connect, stats, toggle active)
- **Inbox**: Conversation list, messaging, lead conversion
- **Leads**: CRM-style lead tracking with pipeline stages
- **Automation**: Rule-based auto-reply triggers
- **Reports**: Analytics charts (messages, response time, lead conversion)
- **Settings**: Organization settings, notification preferences
- **Admin**: User management, role assignment

## User preferences

- Zod v3.x — use `import { z } from "zod"` (NOT `"zod/v4"`)
- Express 5 params: always cast with `String(req.params.id)` (params are `string | string[]`)
- Never use `console.log` in server code — use `req.log` in routes, `logger` elsewhere
- Theme: deep navy sidebar (hsl(224 40% 12%)), indigo primary (hsl(230 100% 60%))

## Gotchas

- Vite dev server must bind to `::` (IPv6) — `dev.mjs` opens the HTTP server on `::` immediately before Vite initializes, satisfying the port health check.
- The socialboxx artifact ID is `artifacts/socialboxx` (path-based, not UUID) because it was created manually rather than via `createArtifact()`.
- If the `artifacts/socialboxx: web` workflow fails with `EADDRINUSE`, a stale process is holding port 5000. Run `fuser -k 5000/tcp` to free it, then restart the workflow.
- bcryptjs and zod must be in runtime `dependencies` (not devDependencies) in api-server/package.json

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/index.ts`
