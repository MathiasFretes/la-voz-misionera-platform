# M8D — Data reliability and migrations

Migration `002_service_revision.sql` adds a positive, database-managed revision to each Service record. Run `npm run db:migrate` before starting a new API build against an existing database. Applied migration checksums remain immutable; the migrator locks and applies pending SQL in a transaction, and a second run is a no-op.

The API returns `revision` as **ServiceRecord metadata**, separate from the portable Service 0.1 document. A new record has no revision and is inserted only if its ID is free. An update must carry the last revision read from the API. A matching update increments it; a stale update returns HTTP 409 and changes no items. Deletes from the current browser repository send `If-Match` with the last revision; a stale delete also returns 409. Existing pre-M8D queued deletes without a saved revision continue through the legacy path so they can be replayed; future deletes carry a revision.

The browser keeps pending edits and deleted-record snapshots in local storage until the API acknowledges them. On a revision conflict it leaves the remote record untouched, retains the local queue, shows the conflict and offers a JSON download of the local copy. It does **not** guess how to merge two versions of a culto. The operator must review the downloaded copy and decide what to reapply. A retry without resolving the conflicting revision will return 409 again.

The database gate tests create, revision increment, stale update, stale delete, item order and migration idempotence against PostgreSQL. Browser unit tests cover offline replay and recoverable write/delete conflicts. The PostgreSQL browser test from M8C continues to verify that WorshipPlan 0.1 imports and Service 0.1 exports survive a cache clearing and convert with Presenter.

This is still a local, single-operator API. Auth, permissions, public exposure, automatic conflict merge and continuous backup scheduling are outside M8D. Backup and restore procedures belong to M8E.
