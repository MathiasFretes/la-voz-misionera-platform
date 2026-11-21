# Gate de planificación por iglesia — 21 de noviembre de 2026

## Resultado funcional

Los ocho escenarios se ejecutaron con navegador real sobre el build productivo y una API/PostgreSQL aislados en el VPS. Después se repitieron sobre **HTTPS y la aplicación publicada**, sin reemplazar sus archivos estáticos. Las peticiones de prueba introducen fallos/retenciones de red controlados; las escrituras, sesiones, permisos y revisiones se procesan en la API y PostgreSQL reales.

| Escenario                   | Evidencia comprobada                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear sin conexión          | Chrome sin conexión; borrador persistido en IndexedDB; servidor sin el plan; reconexión y revisión confirmada.                                                                              |
| Borrar recién creado        | Diálogo desde la interfaz antes del debounce de envío; cero escrituras de servidor y ninguna reaparición. El diario también prueba borrado durante creación en vuelo.                       |
| Editar durante una petición | Respuesta de la versión anterior retenida después del commit SQL; nueva edición local; al liberarla se conserva y sincroniza el título más reciente.                                        |
| Dos pestañas                | Creación concurrente de planes desde ambas interfaces sin pérdida. El diario además conserva 40 borradores simultáneos y una copia explícita ante generaciones concurrentes del mismo plan. |
| Cambiar de iglesia          | Cambio con respuesta de la iglesia anterior retenida; ninguna fila/título anterior aparece en el nuevo ámbito. Acceso de un no miembro rechazado.                                           |
| HTTP 409                    | Escritura real desde otra sesión; copia local conservada; resolución explícita desde la interfaz y nueva revisión guardada.                                                                 |
| Revocar durante sesión      | Responsable pasa a consulta sin cerrar su navegador; siguiente escritura rechazada con 403 y servidor intacto; al recargar, interfaz sin edición.                                           |
| Reiniciar navegador         | Se cierra Chromium y se vuelve a abrir el mismo perfil; cookie persistente, IndexedDB y operación pendiente recuperados. Se sincronizan después sin duplicar el historial.                  |

La prueba de borrado no enviado pausa el reloj del debounce únicamente para asegurar que ningún envío haya comenzado. IndexedDB, interfaz, red y PostgreSQL siguen siendo reales. La prueba de edición en vuelo retiene la respuesta; no simula una revisión exitosa. La confirmación perdida se reproduce después del commit y su reintento conserva el UUID: SQL mantiene una sola revisión.

## Comandos y archivos de verificación

- `npm test`: componentes, repositorio histórico y límites de permisos.
- `npm run test:suite-api`: validación Service 0.1, rutas, revisiones y seguridad.
- `npm run test:planning-journal`: IndexedDB real en dos pestañas, generaciones y operaciones persistidas.
- `suite-api/test/planning.sql`: esquema aislado, permisos por iglesia, conflictos, borrado, idempotencia y revocación incluso al repetir operaciones confirmadas.
- `node scripts/verify-planning-ui.mjs`: build productivo local con backend aislado mediante túnel SSH.
- `LVM_PLANNING_TARGET=production node scripts/verify-planning-ui.mjs`: repetición sobre frontend/API HTTPS publicados; perfiles e iglesias/cuentas temporales se limpian al terminar.
- `npm run lint`, `npm run format:check`, build con `VITE_SERVICE_PLANNING=church` y regresión de `suite-api/test/integration.mjs`.

Capturas de escritorio/móvil: `test-results/planning/church-selector-desktop.png` y `church-selector-mobile.png`. Son fixtures de QA, no contenido institucional permanente.

## CI

`.github/workflows/ci.yml` agrega el job `church-planning`: regeneración del validador, detección de diferencias en el artefacto, pruebas de API, migraciones y permisos en PostgreSQL fresco, Chromium y prueba del diario entre pestañas. No usa credenciales del VPS. Sus comandos equivalentes se ejecutaron durante el desarrollo; **no se afirma una ejecución remota de GitHub Actions para el commit nuevo mientras la rama no se publique**.

## Archivos principales de implementación

| Área                    | Archivos                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interfaz y ámbito       | `src/features/services/PlanningContext.tsx`, `useServices.ts`, `ServiceSyncStatus.tsx`; `src/app/router.tsx`, `shell.tsx`; páginas Home, Services, ServiceEditor y ServiceEditorAccess. |
| Diario y sincronización | `src/repositories/api/PlanningJournal.ts`, `JournalServiceRepository.ts`; interfaz `src/repositories/ServiceRepository.ts`.                                                             |
| API y PostgreSQL        | `suite-api/planning.mjs`, `server.mjs`, `schema/010_church_planning.sql`; validador generado desde el contrato existente.                                                               |
| Verificación            | Scripts `verify-planning-journal.mjs`, `verify-planning-ui.mjs`, `setup-planning-qa.sh`; tests de permisos, SQL y repositorio; workflow y scripts npm.                                  |

Los cambios no cierran toda la suite: el flujo automático con Worship y Presenter, clientes nativos y otros gates siguen abiertos en el roadmap.
