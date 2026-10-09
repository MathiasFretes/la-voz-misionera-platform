# M8A — Backend foundation

M8A adds a local PostgreSQL database and a loopback-only API for LVM Service. It does not switch the editor away from `localStorage` yet. That cutover, including a safe migration path for existing browser drafts, belongs to M8B.

## Boundaries

- `Service 0.1`, `WorshipContext 0.1`, `WorshipPlan 0.1`, and `PublicContent 0.1` remain unchanged.
- The API persists a `ServiceRecord`: `venue` and `worshipAfterItemId` are local Service metadata, outside the portable `Service 0.1` document.
- The database has `services` and ordered `service_items`. Each item keeps its validated 0.1 payload as JSONB; the relational columns enforce identity, kind, position, and cascade deletion.
- Empty editor drafts may be stored. Export to Presenter still uses the existing `parseService` gate, which requires at least one item.
- This API has no Auth or multi-tenant model. It binds only to `127.0.0.1` for local development; do not expose it publicly.

## Local setup

Requires Node 22.23.0 and Docker with Compose. From `LVM Service`:

```powershell
Copy-Item .env.example .env
docker compose up -d db
npm ci
npm run db:migrate
npm run api:dev
```

`GET http://127.0.0.1:4318/health` returns `{ "status": "ok" }` when PostgreSQL is reachable. Database credentials in `compose.yaml` and `.env.example` are for local development only. A different `DATABASE_URL` can be supplied through the environment; environment variables override `.env`.

The API routes are `GET/POST /api/services` and `GET/PUT/DELETE /api/services/:id`. POST creates a record, PUT updates it, and responses are JSON. The HTTP boundary rejects malformed bodies and unsupported `Service 0.1` data before persistence. There are no browser-facing CORS headers; M8B will connect the frontend through a same-origin development proxy and a new repository adapter.

Migrations are ordered SQL files in `backend/database/migrations/`. `npm run db:migrate` records a SHA-256 checksum for each applied file and refuses changed migration files. Add a new numbered migration for schema changes. The repository uses one transaction for each service and its ordered items.

## Verification

```powershell
npm run build:backend
npm run test:backend
npm run lint
npm run build
```

With `DATABASE_URL` set and PostgreSQL running, `test:backend` exercises the real migration, HTTP API, ordered item persistence, reload through a new repository instance, invalid input rejection, and deletion. CI starts PostgreSQL 17 and runs these checks. Without `DATABASE_URL`, only the boundary tests run; the integration tests are skipped.

The optional Editor connection, offline file handoffs and local-draft migration are described in [M8B Service persistence](m8b-service-persistence.md). M8A itself did not alter the source of truth used by the Editor or the other three products.
