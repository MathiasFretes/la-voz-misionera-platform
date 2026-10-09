# M8C — Contract integration after PostgreSQL persistence

M8 changes where Service records are stored. It does not change the four 0.1 file contracts. `ServiceRecord` remains local to LVM Service; the API stores its ordered items and integration metadata, while exported files contain only the fields defined by their contracts.

The PostgreSQL browser gate in `e2e/service-postgres.spec.ts` now exercises this sequence:

1. Create a service and an announcement in the Editor; wait for the API save.
2. Download and parse WorshipContext 0.1.
3. Import a WorshipPlan 0.1 with accented text, an emoji, chords and repeated verse/chorus order.
4. Confirm the import; read the ordered items from PostgreSQL.
5. Clear browser storage and reload; confirm the items still come from the API.
6. Download and validate Service 0.1, then convert that exact export with the LVM Presenter adapter.

CI checks out a pinned Presenter commit only for the last conversion. It does not build or launch Electron. The existing M7 suite demo covers the live Worship application and physical Presenter path in browser-only mode; this M8C test specifically checks that adding PostgreSQL has not changed the exported contract or lost the imported arrangement. PublicContent 0.1 remains a separate preview file flow and does not read Service records; its validator and existing preview demo remain unchanged.

The backend mode is selected with `VITE_SERVICE_BACKEND=postgres`. Without it, Service keeps its local/offline repository and file handoffs. No contract version was raised for M8C.
