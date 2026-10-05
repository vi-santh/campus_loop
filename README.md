# CampusLoop — College Resource Exchange

CampusLoop helps students, clubs, labs, and departments keep useful campus resources in circulation. People can share unused items, discover what they need, request a handoff, and record the completed reuse event.

## Architecture

```text
React + Vite
      ↓
Express REST API
      ↓
PostgreSQL + Drizzle ORM
```

The API contract lives in `lib/api-spec/openapi.yaml`. React Query hooks and server-side Zod schemas are generated from it.

## Requirements

- Node.js 24+ (includes npm)
- PostgreSQL 14+

## Local setup

Follow [SETUP.md](SETUP.md) for the first-time local setup, including PostgreSQL, environment variables, schema initialization, and starting the web app and API.

The repository uses npm workspaces. From the repository root:

```bash
npm ci
npm run typecheck
```

Useful workspace commands:

```bash
npm run db:push
npm run dev:api
npm run dev:web
npm run api:codegen
```

`dev:api` and `dev:web` are separate long-running processes and need separate terminals. For local web development, use `LOCAL_API_PROXY=true` as shown in `SETUP.md`; Replit routes `/api` through its shared proxy.

The API seeds categories, demo accounts, listings, requests, and notifications on first startup when the database has no users.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret used to sign bearer tokens; set a unique value outside local demos |
| `ENFORCE_COLLEGE_DOMAIN` | Set to `true` to restrict registration to the configured campus email domain |
| `COLLEGE_EMAIL_DOMAIN` | Campus email domain used when domain enforcement is enabled |

Never commit real secrets.

## Demo accounts

All seeded accounts use the development-only password `CampusLoop123!`.

| Account | Email | Role |
| --- | --- | --- |
| Aarav Mehta | `student@example.com` | Student |
| Maya Iyer | `maya@example.com` | Student |
| Robotics Club | `organization@example.com` | Organization |
| Campus Admin | `admin@example.com` | Admin |

## Core workflow

1. Register or sign in.
2. Browse the marketplace and search/filter resources.
3. Open a listing and send a request message.
4. The owner reviews incoming requests.
5. The owner accepts or rejects the request.
6. An owner or requester marks the accepted exchange complete.
7. The listing's available quantity is reserved and the reuse event is recorded.
8. Both sides receive in-app notifications and dashboard state updates.

## API surface

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET|POST /api/listings`
- `GET|PATCH|DELETE /api/listings/:id`
- `GET|POST /api/requests`
- `PATCH /api/requests/:id/accept`
- `PATCH /api/requests/:id/reject`
- `PATCH /api/requests/:id/cancel`
- `PATCH /api/requests/:id/complete`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `GET /api/dashboard`
- `GET /api/impact`
- `GET /api/admin/statistics`

## Checks

```bash
npm run api:codegen
npm run typecheck
PORT=5173 BASE_PATH=/ npm run build
```

For Windows PowerShell, set the build variables before running the build:

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
npm run build
```

The main request workflow can also be exercised with the seeded accounts using the API endpoints above.