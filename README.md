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

## Project Structure

```text
apps/
	api/
	web/
	worker/
packages/
services/
```

## Notes

- Frontend product logic and UI were kept unchanged during the monorepo refactor.
