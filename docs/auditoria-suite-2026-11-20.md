# Auditoría de la suite LVM — 20 de noviembre de 2026

## Fuente y alcance

Se contrastaron el roadmap, los gates M7/M8, los cinco checkouts y el despliegue por SSH. No se revalidaron los estados remotos de PR ni se repitieron QA físico Android, instalación Windows limpia o compilación macOS. Ninguna de esas condiciones se considera satisfecha por los tests web.

| Producto       | Evidencia actual                                                                                                                                                          | Pendiente real                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Pública    | 18 pantallas V0 desplegadas; formularios privados; lectura anónima de publicaciones; calendario usa eventos y mes actual; enlaces publicados de prédicas                  | Resto del CMS, contenido institucional aprobado y revisión de acciones heredadas de V0; las previews de cuatro páginas siguen separadas                                           |
| Service        | Sesión compartida, administración de cuentas/roles y bandeja; editor conectado de seis colecciones con borrador/publicación/retiro, revisión esperada e historial privado | Iglesia/membresía/capacidades, personas/equipos/sedes como organización, planificación remota autenticada y resto del CMS                                                         |
| Worship        | Web desplegada sobre API propia y PostgreSQL; 535 tests locales pasaron durante el trabajo offline; descarga y recarga sin red comprobadas localmente                     | Los cambios offline recientes no están desplegados; quedan W2, sincronización con conflictos y migración nativa. Se conserva su árbol de trabajo sin mezclarlo en este despliegue |
| Presenter      | 5/5 tests actuales de importación Service 0.1 y CLI; HEAD local `e3c8d4b` incluye snapshot remoto rico                                                                    | Firma, distribución/NSIS, VM limpia y nuevo QA físico/remoto; el archivo PDF worker modificado ya existente no se toca                                                            |
| Mobile Flutter | HEAD local `187b683`; README y módulos distinguen cuatro bases Android y límites de API/persistencia. Worship Flutter sigue siendo preview contractual                    | Conexión a identidad/API real y QA Android; los directorios no rastreados existentes no se toman como entregables verificados ni se modifican                                     |

## Gates revisados

- **M7:** cerrado para el intercambio local de archivos 0.1 y la identidad visual. Su acta ya limita la aprobación a ese alcance.
- **M8:** cerrado para la API de planificación, PostgreSQL, concurrencia y operaciones en el entorno de ese milestone. `backend/` no está expuesto en el VPS actual; no activar ese backend sin integrar la autenticación de la suite.
- **M9:** autenticación web y roles globales desplegados; `ChurchId`, `Membership` y capacidades por organización siguen pendientes. No declarar M9 cerrado.
- **M10:** organización de iglesia/personas/equipos pendiente. Publicar una tarjeta de sede en la web no crea permisos ni una sede organizacional.
- **M11 / W2:** intercambio local disponible; falta la vertical remota autenticada completa Service → Worship → Service → Presenter con recuperación y revisión.
- **M12:** en curso por prioridad explícita del usuario. Seis colecciones conectadas; no es todavía el CMS editorial completo.
- **M13:** la web está publicada; API pública versionada y migración funcional completa siguen pendientes. Mantener `PublicContent 0.1` como contrato existente.
- **M14 y W4:** conservar evidencia histórica de Android/remote; no convertir documentación antigua de CI ni tests de tokens en aprobación de release o macOS.

## Seguridad y persistencia

La administración vive en Service. La API valida permisos y contenido; PostgreSQL protege las escrituras y el acceso a borradores, además de la UI. Los borradores de documentos publicados están separados de `data`: una edición privada no reemplaza lo que ven los visitantes. La revisión esperada y un bloqueo transaccional rechazan sobrescrituras concurrentes con HTTP 409. El historial privado permite auditar las versiones; todavía no hay restauración de revisiones desde la interfaz.

El VPS es infraestructura compartida con Docker, Caddy/HTTPS y PostgreSQL privado. Se realizó un backup antes de la migración editorial. Continúan pendientes backups externos automáticos y monitoreo operativo; la copia externa manual y las restauraciones anteriores no sustituyen esos pendientes.

OAuth, recuperación por email, correo transaccional y pagos no están configurados. La bandeja almacena solicitudes; no envía correos. La base se inició nueva por autorización del usuario, sin migrar Supabase.

## Evidencia ejecutable de este avance

- Service: `npm test`, `npm run lint`, `npm run format:check`, `npm run build`.
- API: `node --test suite-api/test/security.test.mjs suite-api/test/site-content.test.mjs` y `test/integration.mjs` dentro del perfil administrativo del VPS. Incluye publicaciones, borradores privados, permisos, conflicto entre editores y retiro.
- Navegador real en el VPS: `node scripts/verify-vps-content.mjs` pasó el recorrido de borrador → publicación → calendario público → conflicto con texto conservado → retiro, con captura a 1440 y 390 px.
- Web Pública: `npm test`, `npm run build`, `scripts/verify-public-pages.mjs`.
- Presenter: `node --test` sobre los cinco tests de `src/lvm/*.test.mjs`.

Los verificadores crean y limpian registros propios de QA. No se publican fixtures institucionales permanentes ni se modifican cuentas reales para las pruebas.

Resultado de esta revisión: 29 tests de Service, 40 de Web Pública, 5 de seguridad/validación de la API y 5 de contratos Presenter pasaron. Lint, formato y builds también pasaron. Las 18 páginas públicas se comprobaron a 390 y 1440 px; el ingreso compartido y la bandeja se volvieron a verificar en el VPS. La restauración de un dump nuevo confirmó la migración 007, el historial y la prohibición de leer borradores como visitante. La copia externa manual cifrada del dump `lvm_worship_20261120T190137Z` se verificó en esta PC; no es un backup externo automático.
