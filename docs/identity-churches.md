# Identidad por iglesia — primera vertical M9

La identidad web conserva la cuenta y sesión compartidas. Una membresía vincula esa cuenta a una iglesia; no modifica su rol global. Service administra ambas dimensiones por separado.

## Permisos y límites

| Rol de iglesia | Consulta de miembros | Modificación de miembros    | Capacidades de planificación previstas |
| -------------- | -------------------- | --------------------------- | -------------------------------------- |
| Administrador  | Sí                   | Sí, excepto administradores | Lectura y preparación                  |
| Responsable    | Sí                   | No                          | Lectura y preparación                  |
| Miembro        | No                   | No                          | Lectura y preparación musical          |
| Consulta       | No                   | No                          | Lectura                                |

Solo un administrador global puede crear/suspender iglesias, asignar cuentas nuevas desde el directorio y designar o cambiar administradores de iglesia. El administrador de iglesia puede modificar miembros no administrativos de su organización; la API también admite asignaciones por ID conocido. La interfaz de iglesia se limita a las cuentas ya asignadas y no enumera usuarios globales.

La sesión devuelve `memberships`, incluyendo estado de iglesia, estado de membresía y capacidades efectivas. Las capacidades se vacían al suspender la iglesia o membresía. La API y las funciones de PostgreSQL recalculan la autorización en cada operación; la sesión del navegador no constituye la autoridad para escribir. Las capacidades de planificación y preparación musical son el contrato para los próximos adaptadores: todavía no conectan el planificador local ni cambian los permisos de datos musicales existentes.

`/service/admin` conserva la administración global y agrega iglesias/membresías. `/service/organization` permite entrar a administradores y responsables de iglesia sin conceder acceso a cuentas globales, CMS, bandeja ni planificación global. Los accesos directos a estas rutas también se comprueban. Los miembros sin capacidad de administración siguen usando Worship.

## Persistencia y seguridad

- Migración `008_church_identity`: tablas privadas `churches`, `church_memberships`, `identity_audit`; sin acceso directo de visitantes ni usuarios.
- RPC: `list_churches`, `my_church_memberships`, `list_church_memberships`, `save_church`, `save_church_membership`. Las escrituras solo aceptan POST y mantienen los controles de origen/JSON de la API.
- Revisión esperada por iglesia y membresía: HTTP 409 cuando otra sesión guardó primero. El formulario conserva el texto y permite descartar/recargar explícitamente.
- Bloqueo transaccional de iglesia para serializar asignaciones, suspensiones y cambios de membresía. No se puede retirar al último administrador activo mediante el editor de membresías.
- Cada guardado registra actor, versión anterior y posterior en un historial privado. La eliminación global de cuentas sigue siendo un procedimiento separado.
- Migración `009_account_directory`: `list_suite_accounts` muestra correos únicamente a administración global. Los correos no regresan a la tabla pública de perfiles ni se exponen a administradores de iglesia.
- No se crean membresías automáticamente al registrarse ni se asignan iglesias a cuentas existentes por coincidencia de nombre.

## Verificación

`suite-api/test/church-identity.mjs` usa PostgreSQL/API reales y limpia exclusivamente sus cuentas e iglesias de QA. Comprueba aislamiento entre dos iglesias, rechazo de elevación global, directorio privado, capacidades, revocación sobre sesiones existentes, conservación del último administrador y concurrencia con un éxito/un HTTP 409.

`scripts/verify-vps-identity.mjs` recorre creación/asignación global, entrada limitada a Service, edición autorizada, denegación de ruta global, conflicto con cambios conservados, recarga y suspensión a 1440/390 px. Las pruebas de componentes cubren revisiones confirmadas, descarte explícito, vista de consulta y el límite de acceso global.

## Pendiente para cerrar M9

Adoptar esta identidad y sus capacidades en planificación remota, Worship Expo y demás clientes; completar recuperación segura de cuentas y comprobar el flujo integral entre productos. Personas, equipos y sedes organizacionales siguen dentro de M10. Esta vertical no cierra esos gates.
