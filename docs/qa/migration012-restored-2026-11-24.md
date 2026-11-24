# Migración 012 sobre respaldo restaurado — 24 de noviembre de 2026

**Resultado: ensayo aislado aprobado. Producción y despliegue sin reanudar.**

## Procedencia

- Service autorizado: `a622fd0171eb469b2a42ca8bd3820cbd1a8e58a3`, descargado desde GitHub; API/esquema sin cambios respecto de la integración aprobada.
- `suite-api/schema/012_editor_transactions.sql`: SHA-256 `a5569f472fad277df9dd54b58f631f00920182cb2bf926d8ceeeae4b99132b6f`.
- Respaldo nuevo `lvm_worship_pre_release_20261124T191057Z.dump`, 127946 bytes; SHA-256 `83f907bfb232c44197864f5661b005301bf31af8a148a624ff3a95589ad491b8`. Disponible y con checksum idéntico al finalizar.
- PostgreSQL 17 Alpine, instancia temporal sin red, sin puertos publicados, almacenamiento tmpfs, sin montajes de secretos ni volúmenes productivos. El dump se copió al contenedor. No se copiaron contraseñas ni atributos LOGIN reales.

## Correcciones exclusivas del arnés

El primer intento había creado `lvm_owner NOLOGIN` y pretendía conectarse directamente con ese rol. El procedimiento corregido conecta con el superusuario temporal y antepone `SET ROLE lvm_owner` al SQL dentro de la misma sesión. No se modifica el rol para habilitar LOGIN.

El segundo intento mostró que la base desechable se había creado con propietario postgres. Se contrastó de forma solo lectura con la base de origen: propietario de base lvm_owner, esquema public propiedad de pg_database_owner y private propiedad de lvm_owner. La receta usa ahora `createdb --owner=lvm_owner`; esto reproduce la propiedad original sin agregar permisos ni modificar la migración. El intento fallido se revirtió y su contenedor fue eliminado.

## Comprobaciones ejecutadas

| Gate                                                        | Resultado                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Restauración con propietarios y ACL                         | pg_restore --exit-on-error, satisfactoria                                                                   |
| Aplicación de 012 en copia del estado previo                | Transacción confirmada y registro 012 presente                                                              |
| editor-transactions.sql                                     | Aprobado: RPC, idempotencia, aislamiento, rechazo de escrituras directas y rollback ante fallo de auditoría |
| editor-revisions.sql                                        | Aprobado: revisión obligatoria, revisión obsoleta y propuestas desactualizadas                              |
| editor-draft-lifecycle.sql                                  | Aprobado: transiciones y conservación de historial/dependencias                                             |
| 012 down + editor-rollback.sql                              | Aprobado: mantiene prohibiciones y conserva auditoría/recibos                                               |
| Reaplicar 012 + editor-revisions.sql                        | Aprobado                                                                                                    |
| Conteos de entidades antes/después de las regresiones SQL   | Idénticos; fixtures transaccionales revertidos                                                              |
| Propietarios de funciones nuevas                            | lvm_owner                                                                                                   |
| Estado LOGIN de roles QA                                    | Continúan NOLOGIN                                                                                           |
| Dos sesiones PostgreSQL solapadas editando la misma canción | Primer escritor confirmado, segundo PT409, sin pérdida de actualización                                     |
| Reintento del primer escritor con el mismo UUID             | Resultado idéntico y un solo recibo                                                                         |
| Limpieza                                                    | Contenedor QA eliminado; checksum del respaldo sin cambios                                                  |

La prueba concurrente confirmó mediante pg_stat_activity que el primer escritor mantenía su transacción abierta después de guardar, antes de iniciar el segundo. Se comprobaron el contenido final y el recibo, no solamente los códigos de salida. Sus fixtures existieron exclusivamente en el contenedor eliminado.

## Límites y siguiente decisión

Esta evidencia cubre PostgreSQL y el ciclo SQL del editor sobre una restauración representativa. No repite identidad, Presenter Remote o G1/G2, ni certifica una nueva prueba visual o recorrido HTTPS del cliente. No cambia código de producto, SQL de migración, roles productivos, imágenes activas, webs o Caddy.

La autorización operativa anterior exigía detenerse ante fallos. **El despliegue permanece detenido y requiere confirmación de reanudación.** Antes de reanudar se revisará vigencia del respaldo, se completarán artefactos y verificaciones pendientes de Worship y se conservará el orden API → webs y el rollback fail-closed. Si hay escrituras posteriores relevantes o cambia la ventana, se hará y validará otro respaldo nuevo.
