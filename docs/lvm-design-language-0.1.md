# LVM Design Language 0.1 — suite preview

Este contrato visual acompaña los cuatro productos sin exigir el mismo framework ni la misma interfaz. Service implementa React; Worship Web y Web Pública implementan React en repositorios separados; Presenter usa Svelte/Electron. Los valores de marca se espejan en cada repo y el verificador de M7.9E detecta divergencias.

## Marca y producto

- Monograma textual **LVM** dentro de un círculo dorado; texto navy. El nombre de producto (`Service`, `Worship`, `Presenter`) se muestra por separado. El monograma no reemplaza un futuro logo aprobado.
- Navy `#0e1a2b`, navy elevado `#172033`, dorado `#c89b3c`, anillo de foco `#b4872e`.
- Paletas de trabajo: Service claro/navy; Worship oscuro/cyan; Presenter oscuro/magenta; Web Pública editorial/navy/dorado/blanco. Los acentos de producto no comunican por sí solos éxito, advertencia o error.

## Primitivas comunes

| Área           | Regla 0.1                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipografía UI  | `Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; el contenido proyectado y los acordes usan sus propias fuentes                 |
| Grid/espaciado | Base de 4 px: 4, 8, 12, 16, 24, 32, 48; columnas y densidad varían según producto                                                                             |
| Radio          | 8 px controles, 12 px tarjetas, 16 px paneles; círculo para monograma/avatar                                                                                  |
| Botones        | Acción primaria única por bloque, texto verbal concreto, estado disabled perceptible, objetivo táctil de al menos 44 px en móvil                              |
| Inputs         | Etiqueta visible, error cerca del campo, foco de 3 px `#b4872e` con offset de 3 px                                                                            |
| Iconos         | Decorativos con `aria-hidden`; las acciones de icono tienen nombre accesible; no depender del icono como única señal                                          |
| Estados        | Loading indica qué se espera; vacío propone siguiente acción; éxito y error describen el hecho; offline distingue datos locales de publicación/sincronización |
| Modales        | Título y acción principal claros, Escape cuando sea seguro, foco retenido y devuelto al disparador                                                            |
| Motion         | 180–220 ms para cambios de UI; respetar `prefers-reduced-motion`; nunca animar el contenido proyectado por una regla global de shell                          |
| Lenguaje       | Nombres de producto actuales: LVM Service, LVM Worship, LVM Presenter, LVM Web Pública. Los nombres de contratos 0.1 permanecen técnicos y versionados        |

## Límites

Este documento fija el ADN compartido, no rediseña todas las pantallas heredadas. La cabina de Presenter mantiene su densidad y su magenta; la Web Pública mantiene su composición editorial. Las capturas comparativas y las brechas por producto se registran en [`m79e-visual-audit.md`](m79e-visual-audit.md). El estado de cada corrección debe comprobarse en código y en una captura nueva antes de cerrar M7.9E.
