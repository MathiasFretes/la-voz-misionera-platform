# Planificación por iglesia — integración en desarrollo

La producción sigue usando planificación local hasta completar el recorrido de interfaz, reconexión y autorización descrito aquí. No activar `VITE_SERVICE_BACKEND=postgres` sobre el singleton anterior: sus claves locales y su ruta histórica no identifican una cuenta ni iglesia.

## Implementado y comprobado localmente

- Migración `010_church_planning`: planes por iglesia, revisión esperada, historial privado y borrado con marca persistente para impedir que una copia offline obsoleta resucite datos eliminados.
- Permisos en PostgreSQL: iglesia activa y membresía activa; lectura para miembros, escritura solo para administradores/responsables; administración global conserva acceso. Las escrituras toman el mismo bloqueo de iglesia que la suspensión/asignación de membresías.
- Rutas propuestas `/api/churches/:churchId/services` y `/api/churches/:churchId/services/:id` dentro de la API compartida: cookie de sesión, comprobación de origen, validación del contrato y token interno. No se expone el backend histórico sin autenticación.
- El validador se genera desde `backend/src/validateRecord.ts` y el parser Service 0.1 existente mediante `npm run build:suite-api`. `suite-api/service-record.mjs` es un artefacto generado, no un segundo contrato mantenido manualmente.
- `createChurchServiceRepository` reutiliza la cola/revisión del adaptador M8. Claves locales separadas por cuenta e iglesia para caché, pendientes y conflictos; no importa automáticamente datos locales anteriores cuya titularidad se desconoce. Las membresías de consulta no pueden crear escrituras desde la fachada.
- Pruebas de ruta/contrato y repositorio. La migración y el aislamiento se comprobaron en una base desechable con `suite-api/test/planning.sql`, incluyendo suspensión, revisión obsoleta, lectura sin escritura e historial del borrado.

## Gate antes de publicar

1. Incorporar selector de iglesia y proveedor de repositorio en la interfaz; comprobar permiso de planificación en rutas además de la API. Conservar acceso explícito a los planes locales anteriores sin subirlos a una iglesia por defecto.
2. Resolver el ciclo de borrado de un plan todavía no sincronizado, incluida una escritura en vuelo; la revisión de borrado no puede inventarse ni omitir el control de concurrencia.
3. Conectar eventos de caché entre pestañas al almacenamiento con prefijo; conservar cambios concurrentes y su recuperación. El envoltorio de almacenamiento todavía no adapta el evento `storage` del repositorio local.
4. Completar pruebas API de sesión real contra una instancia de preproducción y recorridos de navegador: dos iglesias, cuenta cambiada, pérdida de red, recuperación, conflicto y borrado pendiente.
5. Publicar migración/API/interfaz juntos con backup previo, restauración comprobada y registro de versión. No dar por publicado este bloque basándose en las pruebas de componentes o la base aislada.

La nueva API y la migración 010 todavía no están aplicadas a producción. El registro de despliegue sigue identificando la vertical anterior de identidad/CMS.
