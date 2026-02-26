# DevTree — Setup Guide

Step-by-step setup for local development: database, environment variables, auth, and optional tooling. For a minimal quick start see the main [README](../README.md#quick-start).

---

## 1. Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm` (or use Corepack: `corepack enable pnpm`)
- **Docker** (optional) — for local PostgreSQL [docker.com](https://docker.com)
- **.NET 9 SDK** (optional) — only for E2E tests [dotnet.microsoft.com](https://dotnet.microsoft.com)

---

## 2. Install dependencies

```bash
git clone <repo-url>
cd devTree
pnpm install
```

---

## 3. Database

### Option A: Docker (recommended for dev)

```bash
pnpm db:dev
```

This starts PostgreSQL (see `docker-compose.dev.yml`) on port 5432. Default user/pass/db: `devtree` / `devtree` / `devtree`. Connection string:

```env
DATABASE_URL="postgresql://devtree:devtree@localhost:5432/devtree"
```

### Option B: Existing PostgreSQL

Create a database and set `DATABASE_URL` in `.env.development` (see below).

### Apply schema and seed

```bash
pnpm db:push
pnpm db:seed
```

- `db:push` — Pushes the Prisma schema to the DB (no migration files). Use this after pulling schema changes (e.g. `User.preferences`). Uses `dotenv -e .env.development` so `DATABASE_URL` is read from `.env.development`.
- `db:seed` — Runs `prisma/seed.ts`: demo pages + optional default admin (if `ADMIN_PASSWORD` is set).
- If you use migrations instead: `pnpm db:migrate` to create/apply migration files.

---

## 4. Environment variables

### Create env file

```bash
cp .env.development.example .env.development
```

Or copy from `.env.example` if you prefer a single template. **Do not commit** `.env.development` (it’s gitignored).

### Required for auth and DB

| Variable | Example | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://devtree:devtree@localhost:5432/devtree` | PostgreSQL connection string. |
| `NEXTAUTH_URL` | `http://localhost:3000` | Base URL of the app. |
| `AUTH_SECRET` | *(generate below)* | Secret for JWT signing; required in production. |

Generate a secret:

```bash
openssl rand -base64 32
```

Put the output in `.env.development` as:

```env
AUTH_SECRET="<paste-here>"
```

### Optional: default admin

To log in with email/password without OAuth, set:

```env
ADMIN_EMAIL="admin@localhost"
ADMIN_PASSWORD="your-secure-password"
```

Then run:

```bash
pnpm db:seed
```

Log in at `/login` with that email and password. Password must meet the app’s rules (length, upper, lower, number, special character).

### Optional: OAuth (Google / GitHub)

- **Google:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client ID (Web). Redirect URI: `http://localhost:3000/api/auth/callback/google`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **GitHub:** [GitHub Developer Settings](https://github.com/settings/developers) → New OAuth App. Callback URL: `http://localhost:3000/api/auth/callback/github`. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

---

## 5. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll be redirected to `/login` if not authenticated. Sign in with:

- Default admin (if configured and seeded), or  
- Email/password (after registering), or  
- Google/GitHub (if configured).

---

## 6. Troubleshooting

### "Environment variable not found: DATABASE_URL"

- Prisma reads `.env` by default, but our db scripts use `.env.development` via `dotenv-cli`. Ensure `.env.development` exists and contains `DATABASE_URL`.
- Run: `dotenv -e .env.development -- prisma db push` (or use `pnpm db:push` which does this).

### "Unexpected token '<'" or 500 on /api/auth/session

- Usually means `AUTH_SECRET` is missing or wrong. Add a valid `AUTH_SECRET` to `.env.development` and restart the dev server.

### OAuth redirect fails (e.g. Google)

- Check `NEXTAUTH_URL` matches the URL you use (e.g. `http://localhost:3000`).
- In the provider’s console, ensure the redirect URI exactly matches `{NEXTAUTH_URL}/api/auth/callback/google` (or `/github`).

### DB connection refused

- If using Docker: `pnpm db:dev` and wait a few seconds for Postgres to start; then `pnpm db:push`.
- If using a remote DB: check firewall, SSL, and that `DATABASE_URL` is correct.

### Turbopack build fails — "couldn't find next/package.json from ./app"

Full error:
```
Error: Next.js inferred your workspace root may not be correct.
We couldn't find the Next.js package (next/package.json) from the project directory: .../app
```

Cause: Turbopack infers the workspace root from your source tree. When a top-level `app/` directory exists, it can mistakenly treat that folder as the project root instead of the repository root.

Fix: `next.config.ts` already sets `turbopack: { root: '.' }` which pins the workspace root to the repository root. If you ever see this error again, verify that option is present in `next.config.ts`.

---

## 7. Optional: dependency graph

To visualize module dependencies (e.g. for refactors):

```bash
npx madge --extensions ts,tsx --image graph.svg app components lib
```

Requires [madge](https://www.npmjs.com/package/madge); not part of the project’s devDependencies. Output is `graph.svg`. Alternatively use [dependency-cruiser](https://www.npmjs.com/package/dependency-cruiser) for validation and graphs.

---

## 8. Next steps

- **Docs:** [docs/README.md](./README.md) — index of architecture, tech stack, auth, and setup.
- **E2E tests:** [tests/e2e/README.md](../tests/e2e/README.md) — run Playwright E2E with C# .NET.
- **Scripts:** See main [README — Available Scripts](../README.md#available-scripts).
