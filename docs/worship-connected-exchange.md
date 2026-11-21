# Intercambio musical conectado — W2 en desarrollo

## Estado y límite de publicación

La API y la migración 011 se implementaron y comprobaron en una **base aislada** con PostgreSQL/PostgREST y sesiones HTTP reales. No se aplicaron a producción. El VPS sigue usando el commit de planificación publicado `6301397`; el flujo completo Service → Worship → Service → Presenter todavía no se considera terminado.

La revisión de propuestas en Service ya está implementada detrás de `VITE_SERVICE_WORSHIP=connected` y verificada contra el backend aislado. El siguiente trabajo es conectar la interfaz de Worship, su borrador privado por cuenta/iglesia/culto y la cola offline. Los cambios offline existentes de Worship se conservan por separado. No se modificaron sus locales revisados ni sus archivos durante esta entrega.

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

La vista de consulta también permite ver la propuesta y el acceso a preparación cuando la API devuelve `canPrepare`, sin controles de incorporación. La activación del build permanece apagada en producción hasta que el editor conectado de Worship esté verificado; el enlace de preparación no se considera operativo todavía.

Seis pruebas de componente cubren confirmación, ambas revisiones, UUID persistente, respuesta atrasada, contexto obsoleto, cambios locales y permisos. `scripts/verify-worship-review.mjs` pasó en Chromium con el build productivo y la API/PostgreSQL aislados: vista musical, incorporación confirmada, elementos manuales intactos, estado ya incorporado, HTTP 409 real, actualización explícita de contexto, consulta de músico y ancho móvil de 390 px. El script limpia sus cuentas e iglesia; no se publican fixtures.
