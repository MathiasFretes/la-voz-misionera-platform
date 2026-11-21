# Planificación por iglesia — desplegada

Service usa la sesión compartida y PostgreSQL para planificar por iglesia. El build productivo activa `VITE_SERVICE_PLANNING=church`; el modo histórico `VITE_SERVICE_BACKEND=postgres` se conserva para los gates M8 y no se publica como API sin autenticación.

## Interfaz y persistencia

- Selector de iglesia en lista, creación y editor. El proveedor se identifica por cuenta, iglesia y permiso; al cambiar de ámbito se desmonta el anterior y sus peticiones se cancelan. Ninguna respuesta anterior puede actualizar el nuevo ámbito.
- `PlanningJournal` conserva borradores, generaciones, operaciones en vuelo y conflictos mediante transacciones IndexedDB. El diario se separa por `userId`, `churchId` y `serviceId`.
- `JournalServiceRepository` coordina pestañas con BroadcastChannel; la corrección depende de transacciones/generaciones y recibos de operación, no de la entrega del mensaje. La revisión confirmada se incorpora sin reemplazar una edición de generación posterior.
- Cada operación persistida tiene UUID y revisión esperada. PostgreSQL guarda su solicitud y respuesta; reintentar el mismo UUID no duplica la escritura ni el historial. Reutilizarlo con otro actor o payload se rechaza. Los permisos se vuelven a comprobar incluso al reintentar una operación confirmada.
- Cancelar una creación aún no enviada elimina su operación pendiente. Si la creación está en vuelo, el borrado conserva su copia y utiliza la revisión confirmada; un borrado repetido es idempotente y las marcas persistentes impiden resurrecciones obsoletas.
- HTTP 409 conserva la copia local y ofrece `Conservar mi versión` o `Usar versión del servidor`. Las copias también se pueden descargar. No se fuerza una revisión ni se sobrescribe automáticamente contenido remoto.
- `saving-local` distingue la escritura IndexedDB todavía no confirmada de una operación ya guardada localmente y pendiente de servidor. Hay aviso al cerrar mientras existen cambios sin persistir y se comprueban esas escrituras antes de cambiar de iglesia.
- Los planes anteriores del navegador siguen disponibles por opción explícita de administración global. No se asignan ni suben automáticamente a una iglesia. El adaptador inicial de prefijos localStorage fue sustituido por el diario transaccional; no se mantiene como segundo motor de sincronización.

## API y seguridad

`GET /api/churches/:churchId/services`, `PUT` y `DELETE /api/churches/:churchId/services/:id` viven en la API compartida. Requieren sesión; `X-LVM-Account` debe coincidir con la cuenta autenticada y cada escritura incorpora `X-LVM-Operation`. El ID y la iglesia proceden de la ruta. Se conservan los controles de origen, JSON y tamaño.

La migración `010_church_planning` agrega planes, historial y recibos privados. Los usuarios no acceden directamente a esas tablas. Las funciones autorizan lectura de membresías activas y escritura de administradores/responsables; administración global conserva acceso a iglesias activas. Suspender la iglesia o membresía revoca permisos en PostgreSQL inmediatamente. Consulta muestra el plan sin controles de edición ni creación.

El parser Service 0.1 existente se reutiliza mediante `npm run build:suite-api`; el archivo generado `suite-api/service-record.mjs` no se edita manualmente. Los contratos con Worship y Presenter permanecen iguales.

## Evidencia

Ver [gate de aceptación](planning-acceptance.md). Se ejecutó el recorrido con el build productivo, una API/PostgreSQL aislados en el VPS y nuevamente contra la aplicación HTTPS publicada. Los verificadores crean y eliminan exclusivamente sus cuentas e iglesias de QA.

La publicación conserva un snapshot del frontend y la imagen/API anteriores en `releases/planning-20261121T124119Z`; la migración es aditiva. Se configuró La Voz Misionera como iglesia inicial con su cuenta propietaria como administradora de iglesia. No se asignaron otras cuentas por coincidencia de nombre.

## Límites restantes de la suite

Esta vertical conecta planificación, identidad y PostgreSQL; no cierra toda la suite. La apertura inicial de la aplicación necesita verificar la sesión y cargar el frontend. El gate offline parte de una aplicación abierta; el reinicio se verifica con sesión persistente y la API de planificación todavía no disponible. No se afirma que exista una distribución PWA completa ni que pueda abrirse por primera vez sin red. Siguen pendientes W2 hacia Worship/Presenter, clientes nativos, recuperación por email y demás gates del roadmap.
