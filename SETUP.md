# Local setup

This guide sets up the full CampusLoop app on a local machine with npm and PostgreSQL.

## Prerequisites

- Node.js 24 or newer, with npm
- PostgreSQL 14 or newer, running locally
- A terminal with Bash support (macOS/Linux, WSL, or Git Bash)

## 1. Create a local database

Create an empty PostgreSQL database named `campusloop`. For example, if your local PostgreSQL user is `postgres`:

```sql
CREATE DATABASE campusloop;
```

If needed, create a PostgreSQL role first and grant it ownership of the database. Keep your local database password private.

## 2. Install dependencies and configure the environment

From the repository root:

```bash
npm ci
cp .env.example .env
```

Edit `.env` and set the connection string and a local signing secret:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/campusloop
SESSION_SECRET=replace-with-a-long-random-value
ENFORCE_COLLEGE_DOMAIN=false
COLLEGE_EMAIL_DOMAIN=college.edu
```

Generate a strong local value for `SESSION_SECRET` with:

```bash
openssl rand -hex 32
```

Do not commit `.env` or share its values.

## 3. Initialize the database

In the same terminal, load `.env` and apply the Drizzle schema:

```bash
set -a
. ./.env
set +a
npm run db:push
```

## 4. Start the API and web app

Keep the API running in the first terminal:

```bash
set -a
. ./.env
set +a
PORT=8080 npm run dev:api
```

In a second terminal, start Vite with its local API proxy enabled:

```bash
PORT=5173 BASE_PATH=/ LOCAL_API_PROXY=true npm run dev:web
```

Open <http://localhost:5173>. The local Vite proxy forwards `/api` requests to the API on port `8080`. This proxy is enabled only when `LOCAL_API_PROXY=true`; Replit uses its own shared `/api` route.

## Windows PowerShell

In the API terminal, set the environment values from `.env` (or enter them directly without committing them), then run:

```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/campusloop"
$env:SESSION_SECRET = "your-local-random-value"
$env:ENFORCE_COLLEGE_DOMAIN = "false"
$env:COLLEGE_EMAIL_DOMAIN = "college.edu"
$env:PORT = "8080"
npm run db:push
npm run dev:api
```

In another PowerShell terminal:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
$env:LOCAL_API_PROXY = "true"
npm run dev:web
```

## Seeded demo accounts

On first API startup, an empty database is seeded with categories, demo users, listings, requests, and notifications. Demo accounts use the development-only password `CampusLoop123!`; see the account list in [README.md](README.md).

## Useful commands

Run from the repository root:

```bash
npm run typecheck
npm run api:codegen
npm run db:push
```

To build all workspaces, set the frontend's required build environment:

```bash
PORT=5173 BASE_PATH=/ npm run build
```

For Windows PowerShell, set `$env:PORT = "5173"` and `$env:BASE_PATH = "/"` before running `npm run build`.
