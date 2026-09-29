# M7.6 — mapa de migración de producto y UX desde V0

**Estado:** auditoría documental. **Fuente V0:** `C:\la-voz-misionera-v0`, commit `7ac8ae5dd4aa240c83f6cc411a53920d2ef97529` más los cambios locales enumerados abajo. V0 es de solo lectura. La nueva implementación vive en los repositorios LVM actuales.

Este mapa registra decisiones de producto, estructura y campos; **no autoriza** copiar Expo, React Native Web, NativeBase, Firebase/Firestore, navegación ni componentes del proyecto anterior. Las decisiones son propuestas de migración sujetas al gate de cada vertical slice. La auditoría no crea módulos ni backend.

## Evidencia y límites

- Inventario desde `src/screens/pageRouter.tsx`, `src/types/pages.ts` y `src/admin/navigation/WebAdminNavigator.tsx`: 19 pantallas públicas (incluidas Contacto, Privacidad y 404), 14 vistas administrativas y login. El admin se abre con siete pulsaciones sobre la marca. `PageId` es estado React, no una URL enrutable.
- Las fichas están en [pantallas públicas](v0/public-screens.md), [administración](v0/admin-screens.md), [campos de dominio](v0/data-fields.md) y [flujos/assets](v0/flows-assets.md). Las capturas públicas desktop 1440×900 y móvil 390×844 provienen de `dist/` preexistente, servido localmente sin modificar V0. Son evidencia de primer viewport, no prueba de todos los estados ni de paridad exacta con el fuente sin compilar.
- El árbol V0 estaba modificado al auditarlo: `App.tsx`, `firestore.rules`, `public/manifest.json`, `scripts/verify-admin-seed.js`, `src/constants/design.ts`, `src/hooks/useSEO.ts`, `src/navigation/NavbarDesktop.tsx`, `src/screens/home/FooterSection.tsx`, `src/screens/pageRouter.tsx`, `src/types/pages.ts`; además `ContactoScreen.tsx`, `NotFoundScreen.tsx`, `PrivacidadScreen.tsx` y `src/utils/seoSchemas.ts` sin seguimiento. Esas tres pantallas deben revalidarse contra un commit V0 estable antes de implementar.
- La ejecución del `dist` recibió `permission-denied` en listeners Firestore. Las capturas de varias listas muestran carga o fallback. No hay credenciales de admin en la auditoría: solo se capturó el login; las 14 vistas internas se estudian por código, con captura visual **pendiente**. La ficha no afirma que su flujo esté probado en vivo.
- `assets/` contiene iconos/splash de Expo. Las imágenes de hero, retratos y portadas se referencian por URL o fallback; deben inventariarse/licenciarse antes de reutilizarlas. El contenido de V0 puede ser demo y exige verificación editorial antes de publicación.
- El hero público toma cuatro slides fijos de `src/data/fallback.ts`: tres fotos remotas de Unsplash y un video remoto de Pexels. El tipo `HeroSlide` y su servicio Firebase no prueban que esos datos controlen la pantalla actual. No mover URL ni imagen al producto sin origen/licencia/uso editorial confirmados.
- En el drawer móvil de `App.tsx`, la opción «BOLETÍN» cae en el `else` de la cadena de navegación y abre `privacidad`; es una contradicción de flujo observada en código. El nuevo router debe cubrir todas las entradas con pruebas de navegación.

## Matriz maestra

`P1` = primera vertical slice candidata; `P2` = tras dominio/API; `P3` = experiencia pública o contenido posterior. `Documentado` no equivale a implementado. Dependencia `M8/M9` significa persistencia, identidad/permisos o publicación aún no disponibles.

| Pantalla V0              | Decisión          | Nuevo módulo y dueño                                     | Dependencia                          | Prioridad | Estado                     |
| ------------------------ | ----------------- | -------------------------------------------------------- | ------------------------------------ | --------- | -------------------------- |
| Inicio                   | ADAPTAR           | Web pública / Home                                       | CMS, assets y publicación            | P3        | Documentado                |
| Nosotros                 | ADAPTAR           | Web pública / Iglesia                                    | Contenido editorial                  | P3        | Documentado                |
| Pastores                 | ADAPTAR           | Web pública / Liderazgo; datos Platform/Organización     | Personas, CMS                        | P2        | Documentado                |
| Prédicas                 | ADAPTAR           | Web pública / Media; datos Platform/Contenido            | Media, publicación                   | P2        | Documentado                |
| Biblioteca               | ADAPTAR           | Web pública / Media; datos Platform/Contenido            | Misma colección de prédicas          | P2        | Documentado                |
| En Vivo                  | REHACER           | Web pública / Transmisión                                | Proveedor streaming, estados reales  | P3        | Documentado                |
| Devocional               | ADAPTAR           | Web pública / Devocionales; datos Platform/Contenido     | CMS/publicación                      | P2        | Documentado                |
| Sedes                    | ADAPTAR           | Web pública / Ubicaciones; datos Platform/Organización   | Sedes y mapas                        | P2        | Documentado                |
| Ministerios              | ADAPTAR           | Web pública / Ministerios; datos Platform/Organización   | Ministerios                          | P2        | Documentado                |
| Células                  | REHACER           | Web pública / Grupos; datos Platform/Organización        | Grupos, privacidad, registro         | P2        | Documentado                |
| Oración                  | REHACER           | Web pública / Solicitud de oración                       | Canal seguro, privacidad             | P3        | Documentado                |
| Calendario               | ADAPTAR           | Web pública / Agenda; datos Platform/Operación           | Eventos                              | P1        | Documentado                |
| Donaciones               | REHACER           | Web pública / Donaciones                                 | Datos bancarios/pasarela verificados | P3        | Documentado                |
| Boletín                  | REHACER           | Web pública / Boletín                                    | Ediciones y suscripción reales       | P3        | Documentado                |
| Redes                    | ADAPTAR           | Web pública / Contacto y redes; datos Platform/Contenido | Enlaces verificados                  | P3        | Documentado                |
| Soy Nuevo                | REHACER           | Web pública / Primera visita                             | Registro y consentimiento            | P3        | Documentado                |
| Contacto                 | ADAPTAR           | Web pública / Contacto                                   | Canal de envío y datos verificados   | P3        | Documentado                |
| Privacidad               | REHACER           | Web pública / Legal                                      | Texto legal aprobado                 | P3        | Documentado                |
| 404                      | PORTAR CASI IGUAL | Web pública / Sistema                                    | Router nuevo                         | P3        | Documentado                |
| Admin: acceso            | REHACER           | Platform / Identidad                                     | Auth/roles M8/M9                     | P2        | Código y login capturados  |
| Admin: Eventos           | ADAPTAR           | Platform / Operación                                     | Modelo, repository/API, auth         | P1        | Fichado; captura pendiente |
| Admin: Prédicas          | ADAPTAR           | Platform / Contenido                                     | Media, repository/API, auth          | P2        | Fichado; captura pendiente |
| Admin: Pastores          | ADAPTAR           | Platform / Organización                                  | Personas, repository/API, auth       | P2        | Fichado; captura pendiente |
| Admin: Ministerios       | ADAPTAR           | Platform / Organización                                  | Personas, repository/API, auth       | P2        | Fichado; captura pendiente |
| Admin: Células           | REHACER           | Platform / Organización                                  | Privacidad, repository/API, auth     | P2        | Fichado; captura pendiente |
| Admin: Sedes             | ADAPTAR           | Platform / Organización                                  | Horarios, repository/API, auth       | P2        | Fichado; captura pendiente |
| Admin: Radios            | ADAPTAR           | Platform / Contenido                                     | URLs de streaming, auth              | P3        | Fichado; captura pendiente |
| Admin: Estudios          | ADAPTAR           | Platform / Contenido                                     | CMS, repository/API, auth            | P2        | Fichado; captura pendiente |
| Admin: Redes             | ADAPTAR           | Platform / Contenido                                     | URLs, repository/API, auth           | P3        | Fichado; captura pendiente |
| Admin: Devocionales      | ADAPTAR           | Platform / Contenido                                     | CMS, repository/API, auth            | P2        | Fichado; captura pendiente |
| Admin: Testimonios       | REHACER           | Platform / Contenido                                     | Consentimiento, moderación, auth     | P2        | Fichado; captura pendiente |
| Admin: Horarios          | ADAPTAR           | Platform / Operación                                     | Recurrencias, repository/API, auth   | P1        | Fichado; captura pendiente |
| Admin: Contenido         | REHACER           | Platform / Contenido                                     | CMS modular, auth                    | P3        | Fichado; captura pendiente |
| Admin: Textos de páginas | REHACER           | Platform / Contenido                                     | CMS modular, auth                    | P3        | Fichado; captura pendiente |

Ninguna pantalla V0 escribe el repertorio de Worship ni proyecta en Presenter. Worship conserva música; Presenter conserva salida/proyección. Platform será dueño de datos editoriales y operativos, y la Web pública de su presentación.

## Orden de implementación y gate

1. **Eventos** como primera vertical slice: modelo de eventos/horarios → repository/API abstracta → UI administrativa → agenda pública → loading/vacío/error → tests → 390/768/1024/1440 → migración de datos cuando exista backend. No se habilita simplemente copiando la pantalla V0.
2. **Prédicas** después: publicación, medios, catálogo y búsqueda; validar URLs/metadata antes de migrar.
3. **Sedes** después: sedes, contacto y horarios; confirmar fuente de verdad de horarios con Eventos.

Una pantalla queda migrada cuando conserva las decisiones UX valiosas de su ficha, usa el Design System LVM vigente, funciona en desktop/móvil, tiene estados de carga/vacío/error/éxito donde apliquen, no importa Firebase/NativeBase V0, está conectada al dominio nuevo y supera pruebas significativas. Si el backend no existe, la UX puede aprobarse, pero su implementación productiva permanece pendiente.

**Regla de PR:** toda pantalla nueva LVM que reemplace una pantalla V0 debe enlazar su ficha y explicar en la descripción **qué se preservó, qué cambió y por qué**. Debe mostrar evidencia desktop/móvil y el resultado del gate. Si se propone DESCARTAR, justificar la pérdida funcional y el destino del contenido/datos.
