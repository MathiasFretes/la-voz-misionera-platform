# Intercambio musical conectado — W2 en desarrollo

## Estado y publicación

La API y la migración 011 se comprobaron primero en una **base aislada** y se publicaron el 21 de noviembre de 2026 en `https://srv2137598.hstgr.cloud`. La API corresponde a `0c5e73e`; las interfaces actuales son Service `9d95d54` y Worship `cd2c87a92`. El JSON descargado desde el botón de Service se importó en la compilación Windows de Presenter `43e00b9` y sobrevivió al reinicio offline; la distribución instalable sigue pendiente.

La revisión de propuestas en Service está habilitada con `VITE_SERVICE_WORSHIP=connected`. El editor conectado de Worship, su borrador privado por cuenta/iglesia/culto y la cola offline pasaron tanto QA como el flujo HTTPS publicado. No se modificaron locales con revisión humana.

## API preparada

| Ruta                                                             | Comportamiento                                                                                                                                                          |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/churches/:churchId/services/:serviceId/worship`        | Contexto WorshipContext 0.1, revisión del culto, propuesta musical y revisión, estado de incorporación y capacidades. No devuelve los elementos no musicales del culto. |
| `PUT /api/churches/:churchId/services/:serviceId/worship`        | Envía un WorshipPlan 0.1 con `revision` esperada de la propuesta y `serviceRevision` del contexto. Músicos activos pueden enviar; consulta no puede escribir.           |
| `POST /api/churches/:churchId/services/:serviceId/worship/apply` | Incorpora una propuesta revisada al culto; requiere permiso de planificación y ambas revisiones actuales. No acepta elementos arbitrarios enviados por el músico.       |

Se conserva la cookie compartida, el enlace `X-LVM-Account` con la cuenta autenticada y el UUID persistente `X-LVM-Operation` de cada escritura. Las funciones no se exponen en el proxy genérico de RPC: las propuestas pasan por el parser musical existente generado en `suite-api/worship-contract.mjs`.

## Invariantes

- Las tablas de propuestas, historial y recibos permanecen privadas; permisos comprobados en PostgreSQL en cada operación y antes de repetir un recibo.
- La propuesta está ligada a una iglesia y un culto existentes, y su `setlistId` debe coincidir con el contexto. Una revisión antigua produce HTTP 409 y conserva el contenido anterior.
- Enviar música no modifica el orden completo. Solo un responsable puede incorporarla.
- La incorporación elimina únicamente los elementos administrados por Worship (`lvm-worship:<serviceId>:`), preserva los manuales y respeta el punto de inserción guardado. Las repeticiones reciben IDs distintos.
- Si el punto de inserción desaparece o cambian el culto/propuesta, la incorporación falla sin cambios parciales.
- Los reintentos con el mismo UUID, actor y solicitud devuelven el resultado original sin duplicar historial. Otro contenido o actor con el mismo UUID produce un conflicto.
- Todas las escrituras mantienen un bloqueo transaccional corto de iglesia, compartido con cambios de membresía/suspensión. No hay peticiones HTTP dentro de la transacción SQL.

## Evidencia ejecutada

`suite-api/test/worship-exchange.test.mjs` verifica rutas, contrato, acordes UTF-16, revisiones y rechazo de campos no musicales. `suite-api/test/worship-exchange.sql` se ejecutó con todas las migraciones en una base desechable: aislamiento, músico/consulta/responsable, conflictos, idempotencia, conservación de anuncios/predicación, reemplazo del bloque y revocación.

`suite-api/test/worship-flow.mjs` se ejecutó contra la API del entorno aislado mediante sesiones reales. Comprobó dos envíos concurrentes (un éxito y un HTTP 409), incorporación idempotente, salida válida Service 0.1 y comparación exacta de la combinación SQL con `applyWorshipPlan`, la implementación canónica ya probada de Service. Los fixtures de cuentas/iglesias se limpiaron al terminar. No acepta ejecutarse contra la base productiva.

El workflow preparado agrega el test musical SQL y el control de regeneración del contrato. La ejecución de CI aprobada del commit `6301397` es anterior a este trabajo: no se presenta como evidencia de estos archivos nuevos.

## Revisión desde Service

`WorshipReview` muestra las canciones y tonos recibidos, la revisión de la propuesta y el culto sobre el que se preparó. Exige revisión y confirmación antes de incorporar, bloquea la acción con cambios locales pendientes y conserva la propuesta ante HTTP 409. El UUID de incorporación se conserva en almacenamiento local por cuenta/iglesia/culto para recuperar un reintento tras interrupción. El componente se remonta por ámbito y aborta sus consultas al salir: una respuesta anterior no vuelve a mostrar datos de otra iglesia.

La vista de consulta también permite ver la propuesta y el acceso a preparación cuando la API devuelve `canPrepare`, sin controles de incorporación. El enlace de preparación fue comprobado con el editor real de Worship en QA y producción.

Seis pruebas de componente cubren confirmación, ambas revisiones, UUID persistente, respuesta atrasada, contexto obsoleto, cambios locales y permisos. `scripts/verify-worship-review.mjs` pasó en Chromium con el build productivo y la API/PostgreSQL aislados: vista musical, incorporación confirmada, elementos manuales intactos, estado ya incorporado, HTTP 409 real, actualización explícita de contexto, consulta de músico y ancho móvil de 390 px. El script limpia sus cuentas e iglesia; no se publican fixtures.

`scripts/verify-worship-connected.mjs` pasó con ambos clientes productivos: acceso desde Service como músico, catálogo real de QA, propuesta musical conservada tras interrupción y recarga, reintento, revisión e incorporación como administrador y conservación de la bienvenida manual. Además convierte el resultado con `serviceToProject` de Presenter y abre la propuesta guardada desde un contexto nuevo de navegador, conservando el borrador local anterior. La conversión de proyecto no demuestra recepción por la aplicación de escritorio. El verificador usa únicamente la base aislada y limpia cuentas, canciones e iglesia. Capturas en `test-results/worship-exchange/` (artefactos locales, no fixtures de producción).

Con `LVM_WORSHIP_TARGET=production`, el mismo verificador usa los recursos realmente publicados y la API HTTPS, con fixtures propios de UUID que elimina al terminar. El administrador selecciona la iglesia mediante el selector real antes de revisar: no supone que sea la única iglesia. Este modo pasó después de publicar; también volvió a pasar `LVM_PLANNING_TARGET=production node scripts/verify-planning-ui.mjs` con los ocho escenarios de planificación. QA quedó vacío y se retiraron exclusivamente sus contenedores, red y base aislados.

GitHub Actions aprobó los tres jobs de `0c5e73e`: [ejecución 44910644424](https://github.com/MathiasFretes/la-voz-misionera-platform/actions/runs/44910644424). Las pruebas locales suman 45 de Service, 12 de API y 546 de Worship; lint y builds aprobados. No se atribuye este resultado a commits posteriores de documentación o verificadores.

El snapshot anterior está en `releases/worship-20261121T134628Z` (API, ambas interfaces, imagen anterior y manifiesto). El respaldo posterior `lvm_worship_20261121T135208Z.dump` se restauró en una base desechable: migración 011 presente, funciones autorizadas para `lvm_user`, tablas privadas inaccesibles para `lvm_user`/`lvm_anon` y un único propietario. También se comprobó la copia cifrada DPAPI fuera del VPS. La reversión conserva la migración aditiva y restaura interfaces/API previas; no debe borrar las propuestas productivas.

## Retorno entre iglesias y entrega real a Presenter

El enlace de retorno lleva `churchId`; Service lo contrasta con sus iglesias activas y autorizadas antes de abrir un repositorio. Tiene prioridad sobre la selección anterior. Un enlace ajeno, suspendido, vacío o `legacy` no vuelve silenciosamente a otro ámbito. Seis pruebas nuevas elevaron Service a 51 pruebas; CI `44911664234` aprobó los tres jobs de `9d95d54`. El verificador productivo pasó con una selección anterior distinta y un enlace a iglesia inexistente. Se publicaron las entradas HTML de `/setlist` y las demás rutas directas para que no siguieran cargando bundles anteriores. Snapshot de interfaces: `releases/church-link-20261121T140217Z`.

El verificador ahora usa «Presentación → Descargar para Presenter», guarda `test-results/worship-exchange/connected-service.json` y compara todo el archivo con el plan incorporado. La entrega comprobada tiene SHA-256 `A26CE9C7C673EBFAE478EDB19D9A7D5E9E5FDC6E111B853E217C012368ACE270` (fixture propio de QA, eliminado de PostgreSQL al terminar).

Presenter `config/testing/lvmService.test.ts`, con `LVM_SERVICE_JSON` apuntando a ese archivo, pasó en Electron real: importación directa sin CLI, guardado, reinicio sin red y letra visible. También pasaron los dos recorridos de regresión con proyecto previo y Service con repeticiones. Captura local en Presenter `test-results/lvmService-imports-Service-46353-ine-and-presents-its-lyrics/service-offline-preview.png`. El importador conserva el formato de proyecto existente y valida el lote antes de modificar stores. Estas comprobaciones no demuestran instalador firmado, salida física ni edición musical vinculada durante pérdida completa de Internet.
