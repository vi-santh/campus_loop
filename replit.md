# CampusLoop

CampusLoop is a campus-only resource exchange where students and organizations can list, discover, request, and complete reuse of useful materials.

## Run & Operate

- `npm run dev:api` — run the API server
- `npm run dev:web` — run the web app
- `npm run db:push` — apply the Drizzle schema to the development database
- `npm run api:codegen` — regenerate typed API hooks and Zod schemas
- `npm run typecheck` — full workspace typecheck

The managed workflows start the API and web app with the correct ports and preview routing. The development database is provided by Replit through `DATABASE_URL`.

## Stack

- React + Vite + TypeScript + Tailwind CSS
- Express 5 API with pino logging
- PostgreSQL + Drizzle ORM
- OpenAPI contract with Orval-generated React Query hooks and Zod schemas
- Signed bearer tokens with scrypt password hashing for the local MVP

## Where things live

- `artifacts/campusloop/src/App.tsx` — application routes, screens, and user flows
- `artifacts/campusloop/src/index.css` — CampusLoop visual tokens and utility styles
- `artifacts/api-server/src/routes/campusloop.ts` — auth, listings, requests, notifications, dashboards, admin, and impact API
- `artifacts/api-server/src/lib/auth.ts` — password hashing and signed bearer token helpers
- `artifacts/api-server/src/lib/seed.ts` — idempotent demo data bootstrap
- `lib/db/src/schema/` — source-of-truth PostgreSQL schema
- `lib/api-spec/openapi.yaml` — source-of-truth API contract

## Product

The MVP supports:

- Campus account registration and login
- Searchable, filterable, paginated marketplace listings
- Listing creation, editing, soft removal, and ownership checks
- Donate and exchange listing types
- Request → accept/reject/cancel → complete workflow
- Transactional availability updates
- In-app notifications and unread state
- Student, organization, and admin dashboards
- Factual reuse, donation, and exchange metrics

## Architecture decisions

- Listings are the inventory model; there is no duplicate inventory table.
- The API owns availability, authorization, request transitions, and metrics.
- Admin and owner removals are soft status changes so exchange history remains intact.
- Demo data is inserted on API startup only when the database has no users.
- Images are optional for the MVP; the UI uses a visual fallback when no image URL exists.

## Gotchas

- If the OpenAPI contract changes, run `npm run api:codegen` before checking the API or web app.
- `SESSION_SECRET` is used to sign local bearer tokens. Keep it private.
- Development demo accounts use the same password: `CampusLoop123!`.
