# API compartida de LVM

Autenticación y datos para LVM Web Pública, LVM Service y la web de LVM Worship. Se ejecuta en Docker junto con PostgreSQL y PostgREST, detrás de Caddy. **LVM Service es el panel administrativo**; Worship consume canciones, repertorios y sesiones de música. El API de planificación anterior en `backend/` sigue separado y no se expone sin autenticación por este despliegue.

La infraestructura y configuración están documentadas en `LVM Worship/infra/vps/README.md`. Los secretos se generan solamente en el VPS; `server.mjs` los lee de `/run/secrets`. Las migraciones `schema/*.sql` son exclusivas de la base nueva. No ejecutar los scripts históricos de Supabase ni hacer una restauración encima de datos reales sin revisión. Un rollback de este cambio se hace restaurando un dump en otra base y validándolo, no borrando tablas en producción.

Las tablas públicas tienen RLS. `lvm_api` autentica con SQL parametrizado y privilegios limitados; `lvm_rest` cambia a roles sin login con JWT internos de 60 segundos. Las contraseñas usan scrypt con sal, los tokens de sesión se guardan como hash y la cookie es HttpOnly/Secure. No se concede automáticamente el rol propietario al primer registro. `provision-owner.mjs` reserva explícitamente la cuenta indicada y genera un enlace de activación de un solo uso, válido 24 horas, en un archivo protegido del servidor.

`node --test test/security.test.mjs` verifica hashing y expiración de credenciales internas. `test/integration.mjs`, ejecutado con el perfil Compose de administración sobre la base del VPS, crea y limpia cuentas propias y comprueba autenticación, CSRF, aislamiento entre usuarios, escalamiento de roles rechazado, canciones, repertorios anidados, favoritos, códigos de sesión, activación única y bandeja privada. Nunca usa ni borra cuentas reales.

Los mensajes y solicitudes se almacenan, sin enviar correos automáticamente. OAuth y recuperación por email requieren configurar el proveedor. La API de datos incluye un adaptador de consultas en `LVM Worship/packages/core/src/backend/client.js`; el nombre de exportación web `supabase` permanece por compatibilidad de imports, sin conectar al servicio Supabase. Las sesiones musicales se actualizan mediante consultas periódicas de 1,2 segundos, con control de acceso por código.

La migración `007_site_editor.sql` separa `draft_data` de la versión publicada en `data`, incorpora revisión esperada e historial privado y retira las escrituras directas sobre `site_documents`. Las columnas de borrador no tienen permiso de lectura para los roles públicos ni normales, incluso si el registro está publicado. `list_site_documents` y `save_site_document` comprueban administración en PostgreSQL; la API valida los campos de las seis colecciones admitidas mediante `site-content.mjs`. Una revisión obsoleta responde HTTP 409 sin sobrescribir cambios. Guardar no publica; publicar copia el borrador a la versión pública; retirar la oculta conservando las versiones.

`node --test test/site-content.test.mjs` valida campos, fechas, enlaces y publicación. La prueba de integración también comprueba la privacidad del borrador sobre un registro publicado, la prohibición de modificarlo directamente, dos escrituras concurrentes, retiro e historial. `scripts/verify-vps-content.mjs`, desde la raíz de Service, verifica el recorrido real de la interfaz y limpia sus registros temporales.

## Identidad y planificación por iglesia

Las migraciones 008/009 agregan membresías/capacidades y un directorio de correos limitado a administración global. La migración 010 protege planes, revisiones, historial y recibos de operación en tablas privadas. Las rutas `/api/churches/:churchId/services` usan la sesión compartida; `X-LVM-Account` comprueba la cuenta y `X-LVM-Operation` identifica cada escritura persistida. La API valida Service 0.1 antes de invocar las funciones autorizadas de PostgreSQL. Las funciones de planificación no se añaden a la lista genérica de RPC expuestos.

`LVM_DATABASE` y `LVM_REST_URL` permiten una instancia de QA con base/PostgREST propios; producción conserva los valores por defecto `lvm_worship` y `http://rest:3000`. No configurar QA sobre la base productiva. Ver el [gate ejecutado](../docs/planning-acceptance.md) y la [arquitectura del diario](../docs/planning-church-integration.md).

## Editor transaccional (candidato; solo QA)

La migración `012_editor_transactions.sql` y el RPC allowlisted
`mutate_editor_song` se revisan junto con Worship PR #4. No están desplegados en
producción. El RPC exige sesión/rol desde PostgreSQL, bloquea la fila de destino,
comprueba su revisión y conserva un recibo privado por usuario/UUID. Repetir el
mismo comando devuelve el resultado confirmado; cambiar el contenido con el
mismo UUID devuelve 409. Guardar borrador y enviarlo a revisión es una sola
transacción, incluyendo propuesta/estado/recibo.

La auditoría ya no depende de INSERT desde el navegador: triggers del servidor
la escriben y un error revierte la mutación. Los roles de cliente pierden INSERT
sobre `editor_audit_log`. El wrapper de revisión devuelve la publicación previa
en un reintento idéntico de aprobación/rechazo y rechaza decisiones contradictorias.
El script de migración debe omitir `*.down.sql`; el rollback se aplica solo de forma
expresa, coordinando la versión del cliente y API. Nunca ejecutar toda la carpeta
con un glob que incluya rollbacks.

`test/editor-transactions.sql` verifica permisos reales, reintentos, revisión
obsoleta, denegación tras revocación e inyección de fallos en auditoría. Se ejecuta
con PostgreSQL aislado en CI. El gate real de navegador/API/SQL y sus versiones
están en Worship `apps/web/public/wiki/Editor-Postgres-Acceptance.md` y su reporte
JSON, con versiones exactas, comprobaciones de navegador/API/SQL y limpieza confirmada. Mantener
ambos PR en borrador hasta revisión y autorización. El nuevo cliente requiere
que la migración y API se publiquen primero; no sustituye ni activa la API nativa.

### Cierre de los tres bloqueantes de revisión (candidato)

- **Escrituras protegidas:** se revoca INSERT/UPDATE/DELETE a los roles de cliente
  sobre canciones, propuestas y borradores. Todas las mutaciones del editor web
  pasan por `mutate_editor_song`; también los metadatos PPTX (`update_pptx`).
  La auditoría permanece exclusivamente en servidor.
- **Revisión obligatoria:** cualquier mutación de un registro existente exige
  `p_expected_updated_at` no nulo y coincidente. El reloj de revisión avanza incluso
  dentro de una misma transacción. Actualizar solo el contador de favoritos no
  invalida la revisión musical.
- **Propuestas antiguas:** se captura `base_song_updated_at` al proponer; aprobar
  una edición/eliminación con base ausente u obsoleta devuelve 409 y conserva la
  propuesta. No se rellenan bases históricas automáticamente. Service muestra la
  comparación y exige confirmar `rebase_song_suggestion` con la revisión que se
  comparó, antes de una aprobación separada. Actualizar la base queda auditado y
  nunca publica por sí mismo.

`test/editor-revisions.sql` comprueba estos casos con roles PostgreSQL reales.
CI ejecuta además `012_editor_transactions.down.sql`, verifica con
`test/editor-rollback.sql` que el rollback conserva las prohibiciones de escritura
incluida auditoría, reaplica 012 y repite la regresión de revisiones. El rollback
es deliberadamente **de solo lectura para edición**: conserva datos/recibos y
revoca los RPC de edición/revisión; no restaura la escritura directa insegura.
Para volver a editar se debe reaplicar una versión revisada de 012 y coordinar
API y cliente, sin ejecutar migraciones históricas.

Compatibilidad: el editor web activo usa RPC para guardar/publicar, borradores,
envíos y metadatos de presentaciones; Service usa RPC para revisar y actualizar
bases. El Worker histórico de carga binaria PPTX y el CRUD Supabase/nativo no se
activan ni quedan certificados por este gate del VPS. Solo se prueba el guardado
de metadatos PPTX; no una carga real a ese Worker. Mantener bloqueada su activación
hasta migración y pruebas específicas. No hay despliegue productivo en esta entrega.

### Borradores: estados y conservación de historial

Solo el estado `draft` admite guardar, enviar o eliminar. Un rechazo devuelve
`submitted` a `draft`; una aprobación lo pasa a `published`. `submitted`,
`published` y `archived` rechazan modificaciones ordinarias con 409 incluso con
revisión actual. Los recibos de operaciones ya confirmadas se consultan antes
de validar el estado, para permitir reintentar una respuesta perdida.

Eliminar un borrador con cualquier propuesta histórica o vínculo a repertorio
responde 409 y conserva todos los registros. Un borrador nunca enviado y sin
vínculos puede eliminarse, con recibo idempotente. Las dos claves foráneas hacia
`personal_songs` usan NO ACTION en lugar de CASCADE, incluyendo durante rollback.
No se introduce un archivado automático ni se descartan propuestas rechazadas.
`test/editor-draft-lifecycle.sql` cubre envío/rechazo/edición/reenvío/aprobación,
estados bloqueados, borrado con dependencias y borrado seguro de un borrador libre.
