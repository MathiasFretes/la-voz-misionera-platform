# Preparación de despliegue después de M8

**Estado:** plan técnico; no hay despliegue público autorizado. Todavía no existe VPS ni dominio. LVM Service y LVM Worship deben permanecer sin publicar hasta que M9 implemente Auth y permisos.

## Lo que ya está probado

- La API de Service y PostgreSQL 17 pasan migraciones, pruebas de persistencia, conflictos y backup/restore en CI desde `main`.
- El servidor de Service escucha en `127.0.0.1:4318`. El Compose actual expone PostgreSQL solo en `127.0.0.1:5433` y usa credenciales de desarrollo. Ninguno es configuración de producción.
- `backend/Dockerfile` empaqueta la API y sus migraciones. `deploy/compose.private-smoke.yaml` las ejecuta con PostgreSQL en una red interna, sin publicar puertos del host. El bind `0.0.0.0` solo se configura dentro de ese contenedor; el valor por defecto fuera de él continúa siendo loopback.
- El build normal de Web Pública muestra una página de preparación. La vista con eventos, prédicas y sedes usa fixtures de preview, no contenido aprobado.

## Topología objetivo, todavía sin aplicar

```text
Internet → HTTPS / reverse proxy → Web Pública publicada

Red privada de operación → Service Web → Service API → PostgreSQL
                          → Worship Web (cuando tenga Auth)
```

Presenter Windows y las futuras apps Android son clientes distribuidos; no se ejecutan como sitios web en el VPS. La landing y los artefactos descargables serán otro flujo de release.

Antes de crear un Compose de producción o apuntar DNS, se necesitan: VPS y dominio propios, M9 Auth con roles, contenido público real, configuración de secretos, política de backups fuera del servidor, restauración ensayada en otro entorno y monitoreo. La API no debe quedar publicada por un proxy público mientras cualquier visitante pueda leer o modificar servicios.

## Reglas para la primera infraestructura

1. Instalar PostgreSQL en red privada, sin puerto de base de datos publicado a Internet. Credenciales fuera de Git.
2. Separar migración, arranque y backup en procedimientos repetibles; comprobar `health` contra PostgreSQL.
3. Servir TLS con un reverse proxy cuando existan dominio y DNS. Reservar subdominios solo después de decidir los nombres finales.
4. Dejar Service y Worship accesibles únicamente en un entorno privado de prueba hasta que Auth y autorización estén verificados.
5. No usar `build:preview` de Web Pública para producción ni presentar fixtures como contenido institucional.
6. Probar backup, borrado controlado y restore en el VPS antes de aceptar datos reales.

La documentación de referencia para una futura implementación es [Docker Compose en producción](https://docs.docker.com/compose/how-tos/production/), [secretos de Compose](https://docs.docker.com/reference/compose-file/secrets/) y [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). Este archivo no sustituye una prueba de despliegue en la infraestructura final.

## Prueba privada de empaquetado

El job `private-container` de CI construye la imagen con `npm ci`, ejecuta las migraciones sobre una base nueva y consulta `/health` desde otro contenedor de la misma red. Comprueba también que se aplicaron las dos migraciones y destruye sus volúmenes al terminar. Las credenciales del Compose son exclusivamente de prueba.

Para reproducirlo en un equipo con Docker:

```bash
docker compose -f deploy/compose.private-smoke.yaml build api
docker compose -f deploy/compose.private-smoke.yaml up -d db
docker compose -f deploy/compose.private-smoke.yaml run --rm migrate
docker compose -f deploy/compose.private-smoke.yaml up -d api
docker compose -f deploy/compose.private-smoke.yaml down -v
```

Este Compose no debe utilizarse para datos reales: no configura secretos, backups persistentes, proxy, HTTPS ni Auth.
