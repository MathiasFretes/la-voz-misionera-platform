# Despliegue de LVM — estado del 20 de noviembre de 2026

El usuario autorizó el VPS, Docker, PostgreSQL y la publicación web. El plan anterior de M8 quedó reemplazado por este despliegue. Service es la administración general de la suite.

## Infraestructura comprobada

- Host compartido `srv2137598.hstgr.cloud`, con HTTPS y Caddy.
- `/` sirve la Web Pública V0; `/app` sirve Worship; `/service/` sirve Service.
- PostgreSQL 17 y PostgREST están en una red Docker privada, sin puerto de base publicado.
- `suite-api/` autentica la cuenta compartida mediante cookie HttpOnly y comprueba permisos; sus migraciones no son las migraciones históricas de Supabase.
- La base nueva se inició por instrucción del usuario. No se importaron ni eliminaron datos externos de Supabase.
- Hay backup diario local, restauraciones verificadas y una copia externa manual cifrada. Falta automatizar el backup fuera del VPS y el monitoreo.

## Separación de responsabilidades

La API de planificación M8 en `backend/` mantiene sus pruebas y empaquetado privado. No está expuesta por Caddy y no se debe publicar directamente sin integrar autenticación y permisos de la suite. La planificación desplegada conserva el modo navegador local y los intercambios Service/Worship/Presenter 0.1.

El CMS conectado usa `suite-api/schema/007_site_editor.sql`: borradores privados separados de la versión pública, publicación/retiro explícitos, revisión esperada e historial privado. El rol normal no puede editar contenido ni leer borradores. No confundir estas tarjetas editoriales con las entidades de iglesia/sede y sus membresías pendientes de M9/M10.

El sitio público no usa `build:preview` ni publica fixtures M7.9. Reutiliza las pantallas V0; su lectura anónima filtra lo publicado. Los formularios se almacenan en una bandeja privada de Service, sin enviar correo automáticamente.

## Pendientes de producción

Identidad por iglesia, membresías/capacidades, planificación remota autenticada, sincronización con conflictos, migración de clientes nativos, resto del CMS, medios, OAuth/email y pagos. Presenter requiere firma/distribución y QA en PC limpia; Studio requiere macOS. El despliegue web no cierra estos gates.

El [roadmap canónico](roadmap-suite.md) y la [auditoría integral](auditoria-suite-2026-11-20.md) son la referencia actual. Los detalles históricos de empaquetado privado y CI se conservan en [M8](m8-final-gate.md); no sustituyen pruebas sobre el VPS.
