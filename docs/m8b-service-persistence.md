# M8B — Service persistence

The Service Editor now has a PostgreSQL mode. The browser uses the same-origin `/api` route; Vite forwards it to the local Service API. The API stores `ServiceRecord` and ordered `ServiceItem` rows. The portable contracts (`Service 0.1`, `WorshipContext 0.1`, `WorshipPlan 0.1`, `PublicContent 0.1`) are unchanged.

## Run locally

Copy `.env.example` to `.env`, set `VITE_SERVICE_BACKEND=postgres`, then run:

```powershell
docker compose up -d db
npm ci
npm run db:migrate
npm run api:dev
```

In another terminal, run `npm run dev`. A created service is stored in PostgreSQL once the UI says **Servicios sincronizados con PostgreSQL**. The frontend build selects its repository at build time. A deployment must route `/api` to the Service API on the same origin; the API itself listens on `127.0.0.1` for this local milestone.

Without `VITE_SERVICE_BACKEND=postgres`, the existing browser-only mode remains available. It does not require the API and keeps the established offline file handoffs.

## Existing local drafts and connection loss

On the first successful connection, browser drafts missing from PostgreSQL are uploaded. A draft whose ID already exists remotely and differs is **not** uploaded over the remote record. The original browser copy is kept under `lvm.service.migration-conflicts.v1`, and the UI offers a JSON download. The browser's original records are not cleared before the server confirms migration.

In PostgreSQL mode, edits are saved immediately in the browser cache and queued for the API. The UI distinguishes pending synchronization, a confirmed server save, and connection errors. Pending edits remain in the browser across reloads and can be retried. The Service export and Worship file exchange still use the existing in-memory `ServiceRecord` shape and unchanged validators.

This is a single-user local milestone. M8D will add stronger concurrency/version handling, recovery tools and migration reliability. There is no Auth or public API exposure in M8B.

## Verification

`npm test` covers first-run migration, ID conflicts, offline retry and rapid edits. CI runs PostgreSQL and the browser test in `e2e/service-postgres.spec.ts`: create a service in the UI, save an item, verify the API document, clear browser storage, reload, then verify the service and item still appear. The test also parses the resulting `Service 0.1` document.
