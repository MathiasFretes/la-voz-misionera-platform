# Restauración aislada — 24 de noviembre de 2026

Se restauró el respaldo `lvm_worship_20261124T032454Z.dump` (127443 bytes), SHA-256 `2823e615f0be393b153ff11cf6d304632e17b82388a5f2e2882452b25dcf2ff0`.

La prueba utilizó un contenedor temporal PostgreSQL 17 Alpine, sin red (`network=none`), sin puertos publicados y con almacenamiento efímero tmpfs. No montó volúmenes ni directorios de la base activa. Límites: 512 MiB, una CPU y 128 procesos. Se copiaron al contenedor únicamente los bytes del dump. Los roles nombrados por el respaldo se crearon como NOLOGIN, sin copiar contraseñas ni credenciales.

`pg_restore --exit-on-error` finalizó con código cero, conservando los propietarios y ACL del archivo. La base restaurada mostró los esquemas public/private, 25 tablas en esos esquemas, 22 políticas y 209 restricciones validadas en total (este último conteo incluye catálogos de PostgreSQL). El registro de migraciones contenía 10 entradas y finalizaba en `011_worship_exchange`; la 012 no estaba aplicada en ese respaldo.

El contenedor temporal se eliminó y se comprobó su ausencia. El checksum del respaldo siguió siendo el mismo. No se restauró sobre producción ni se aplicaron migraciones, reiniciaron servicios existentes o modificaron rutas HTTPS.

## Alcance

Esto demuestra una restauración SQL completa del archivo disponible y la conservación de sus propietarios/ACL; no valida los secretos globales ni atributos LOGIN de los roles, un recorrido funcional de la aplicación, o la recuperación completa ante desastre del VPS. No demuestra que un backup anterior contenga las escrituras posteriores. Inmediatamente antes de publicar se necesita un respaldo nuevo y su validación, además de la autorización de despliegue.

La publicación debe mantener autenticación nativa desactivada, actualizar API y webs coordinadamente y conservar rollback de aplicación. El rollback de la migración 012 es fail-closed; no promete habilitar escrituras inseguras del editor anterior. Una restauración sobre producción no se ejecutará automáticamente porque podría perder escrituras posteriores.
