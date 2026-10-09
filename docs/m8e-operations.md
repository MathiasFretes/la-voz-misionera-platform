# M8E — Local operations baseline

This milestone provides a repeatable local database setup and a tested backup/restore path. It is limited to the Compose PostgreSQL database `lvm_service` at `127.0.0.1:5433`; the scripts refuse other database targets. They use PostgreSQL 17 tools from the Compose `db` container, so `pg_dump` and `pg_restore` do not need to be installed separately on Windows.

## Start a local PostgreSQL Service

From `LVM Service`, copy `.env.example` to `.env` and set `VITE_SERVICE_BACKEND=postgres`. Then:

```powershell
docker compose up -d db
npm ci
npm run db:migrate
npm run api:dev
```

Start `npm run dev` in another terminal. The API binds only to `127.0.0.1`; the browser calls it through the Vite same-origin `/api` proxy. `GET /health` returns 200 when PostgreSQL responds and 503 when it is unavailable. Run `npm run db:migrate` before starting an updated API against an existing database, especially after the M8D revision migration. The command is idempotent and rejects an applied migration whose checksum changed.

## Back up and restore

Stop the API and browser editing before restore. Choose a new path for each backup:

```powershell
npm run db:backup -- .backups/lvm-service-2026-10-09.dump
```

The script writes a PostgreSQL custom-format archive to a temporary file and renames it only after `pg_dump` succeeds. It refuses to overwrite an existing backup. `.backups/` is ignored by Git; store important copies outside the workspace as well.

To replace the **local** database from a backup:

```powershell
npm run db:restore -- .backups/lvm-service-2026-10-09.dump --confirm lvm_service
npm run db:migrate
```

Restore requires an explicit database-name confirmation and a `PGDMP` custom archive. `pg_restore` uses one transaction and exits on error. It restores schema, data and the `schema_migrations` ledger from the archive. Run migrations afterward to apply any newer schema changes. Restart the API, open Service and verify the services list and one exported Service 0.1 file. Existing browser drafts may still be queued, so review any reported conflict before retrying synchronization.

## Verification and limits

CI runs PostgreSQL 17, the API and browser contract gate, then creates a control record, backs it up, deletes it, restores the archive and checks its title and revision. The restore confirmation guard is also exercised. The CI backup is temporary and contains no user data.

This is a local development procedure, not production disaster recovery. A hosted deployment will need an independent encrypted backup destination, retention policy, restore drill and access controls. Auth, roles, CMS and public API exposure remain outside M8.
