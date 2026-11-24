# LVM Service

El panel administrativo de la suite se despliega en `/service/admin`, con la cuenta compartida de LVM. La autenticación y las tablas PostgreSQL de usuarios, Worship y contenido público están en [`suite-api/`](suite-api/README.md). La web pública reutiliza las pantallas V0; sus formularios guardan solicitudes en PostgreSQL y se consultan desde Service. La planificación Service 0.1 ya usa PostgreSQL por iglesia con diario local transaccional; conserva los intercambios de archivos con Worship/Presenter. El backend de planificación anterior en `backend/` no se expone sin autenticación.

El estado y el orden de trabajo de toda la suite están en el [roadmap de La Voz Misionera](docs/roadmap-suite.md).

`/service/content` es el editor conectado de eventos, prédicas, sedes, pastores, ministerios y horarios. Guardar un borrador conserva la versión pública; publicar o retirar es una acción explícita. La API exige administración y revisión esperada; los borradores no son legibles por visitantes, aunque el documento tenga una versión publicada. El [estado integral](docs/auditoria-suite-2026-11-20.md) distingue lo desplegado de los gates locales y las funciones pendientes.

El mismo editor administra Inicio/transmisión, Nosotros y devocional mediante los registros editoriales únicos `home`, `nosotros` y `general`. No crea copias aleatorias de una página. `node scripts/verify-vps-editorial.mjs` comprueba el recorrido real y limpia sus registros temporales; se niega a sobrescribir páginas editoriales preexistentes durante QA.

La [planificación autenticada por iglesia](docs/planning-church-integration.md) está publicada en `/service/services`. El [gate de aceptación](docs/planning-acceptance.md) documenta navegador real, desconexión, reinicio, dos pestañas, respuesta atrasada, idempotencia, conflicto y revocación. Los planes anteriores del navegador siguen disponibles por selección explícita y no se suben automáticamente.

## Baseline local y documentación histórica

Las descripciones M6–M8 que siguen conservan su alcance local o de CI. El despliegue web actual usa `suite-api/` para identidad, permisos y CMS; la API de planificación en `backend/` continúa separada y privada.

The PostgreSQL/API layer is documented in [M8A backend foundation](docs/m8a-backend-foundation.md). The optional Editor cutover and safe migration of browser drafts are documented in [M8B Service persistence](docs/m8b-service-persistence.md).

The documentary M7.6 audit of the read-only legacy site lives in [the V0 migration map](docs/v0-migration-map.md). It inventories public/admin screens, data fields and migration gates; it does not add legacy runtime dependencies to Platform.

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
