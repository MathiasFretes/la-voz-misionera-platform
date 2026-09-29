# LVM Platform

M7 connects Platform, Worship, and Presenter by local files. Platform exports a [Worship context](contracts/worship-plan-0.1.md) for the service; Worship returns a music-only WorshipPlan 0.1; Platform merges the selected musical block and exports the existing Service 0.1 to Presenter. The three-product workflow requires no account, API, or Internet connection. Worship's offline draft accepts local ChordPro songs.

LVM Platform owns the order of a church service. M6 is a local React + TypeScript + Vite application: create a service, add and reorder its items, reopen it from the same browser, then export a strict [Service 0.1](contracts/service-0.1.md) JSON for LVM Presenter. It needs no account, database, API, or Internet service.

## Run

Use Node 22.23.0 (`.node-version`):

```powershell
npm ci
npm run dev
```

Open the local Vite URL, create a service under **Servicios**, edit its order, then use **Presentación → Exportar Service 0.1**. **Desarrollo → Contract Inspector** shows and validates the exact JSON, opens a Service file, and exports it. Previously created services are stored in this browser's `localStorage`; use the same browser profile to reopen them. Clearing browser data deletes these local drafts, so export a JSON copy for transfer or backup.

The song editor accepts simple section headers (`# Verso 1`, `# Coro`) and inline chords (`[G]Cantamos`). Repeat a section header and lines when that section should be presented again. Scripture text is entered locally and travels in the JSON. A welcome is an `ANNOUNCEMENT` item in Service 0.1. Venue is local editor metadata and does not appear in the portable contract.

## Architecture

`src/repositories/ServiceRepository.ts` is the UI-facing storage interface. `src/repositories/local/LocalServiceRepository.ts` persists services in `localStorage`; the app's dependency binding is in `src/app/dependencies.ts`. The contract validator and types live in `src/contracts/service.ts`. `src/domain/service` handles notation and export. No component imports the local storage implementation directly.

The app has **Inicio**, **Servicios** (list, create, edit), and **Desarrollo → Contract Inspector**. M6 does not connect Worship automatically and does not implement people, teams, auth, permissions, or remote persistence. The contract remains 0.1; the saved-setlist arrangement backlog in Worship is separate.

## Verify

```powershell
npm run format:check
npm run lint
npm test
npm run build
npm run fixture
```

`npm run fixture` regenerates `fixtures/platform-service.json` from the same domain model. In `C:\lvm-presenter`, convert it with:

```powershell
npm run lvm:service-to-project -- C:\la-voz-misionera-platform\fixtures\platform-service.json C:\la-voz-misionera-platform\fixtures\platform-service.project
```

Import the generated `.project` in Presenter. `npm run test:e2e` runs a browser test against the production preview: it creates a service from the UI, reorders it, closes and reopens the browser profile, and exports valid JSON with external requests blocked. On Windows, set `PRESENTER_REPO=C:\lvm-presenter` before that command to also convert the **UI-exported** file, import it into Electron Presenter, and verify its slide in the output preview. The cross-repository Electron check runs locally; CI covers the contract, storage, lint, format, and build.
