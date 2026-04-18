# DIU Lens Monorepo

Scalable monorepo foundation for DIU Lens. The Next.js frontend app lives in `apps/web/`.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons

## Run Locally

Install dependencies from the repository root:

```bash
pnpm install
```

Start frontend development server from repository root:

```bash
pnpm --filter web dev
```

Build frontend for production:

```bash
pnpm --filter web build
pnpm --filter web start
```

Lint frontend:

```bash
pnpm --filter web lint
```

## One-Command Dev Startup

From the repository root (`~/Code/diu-lens`):

```bash
make dev
```

This will:

- detect local PostgreSQL connection mode (socket or localhost)
- ensure database `diu_lens` exists
- run `alembic upgrade head` in `apps/api`
- start backend (`uvicorn`) and frontend (`next dev`) together
- stream both logs with `[api]` and `[web]` prefixes

Additional targets:

```bash
make migrate   # DB detection + DB create + alembic upgrade head
make api       # backend only (after migrate)
make web       # frontend only
make db-setup  # only detect PostgreSQL and ensure diu_lens exists
```

## Project Structure

```text
apps/
	api/
	web/
	worker/
packages/
services/
```
