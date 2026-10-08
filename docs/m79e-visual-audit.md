# M7.9E — Auditoría visual de la familia LVM

Estado: **auditoría inicial**. La comparación usa las capturas de `docs/screenshots/m79d/` tomadas durante la demo automatizada del 2026-10-08 y las fuentes CSS actuales de cada repositorio. El recorrido manual sigue pendiente; esta auditoría no congela el lenguaje visual.

| Dimensión | Service | Worship | Presenter | Web Pública | Decisión de familia |
| --- | --- | --- | --- | --- | --- |
| Rol | Administración, claro/navy | Música, oscuro/cyan | Cabina, oscuro/magenta | Editorial, navy/dorado/blanco | Mantener los cuatro roles distintos |
| Marca visible | `LV` en círculo dorado | `LVM` en recuadro dorado | Texto magenta “LVM Presenter” | Estrella en círculo dorado | Usar un monograma textual `LVM` coherente y nombre del producto separado; no usar la estrella genérica como logo |
| Base navy/dorado | Tokens `#0e1a2b` / `#c89b3c` | Tokens compartidos con esos valores | Base actual `#242832`, magenta `#f0008c` | Navy/dorado correctos | Navy y dorado son la marca; cyan y magenta quedan como acentos de producto, sin reemplazar estados semánticos |
| Tipografía | Inter → sistema | Sistema | Sistema | Arial | Pila compartida `Inter, system-ui, Segoe UI, sans-serif`; mantener tamaños de presentación configurables separados de UI |
| Espaciado/radio | Escala 4–48, controles 8, cards 12 | Escala 4–32, radio 10/12/16 | Reglas dispersas | Controles 8, varias cifras sueltas | Escala base 4/8/12/16/24/32/48, controles 8, tarjetas 12, paneles 16; cada app puede ajustar densidad |
| Foco | Estilo Design System | Token de foco propio | Magenta actual | `#bf8b27` fijo | Foco visible de 3 px con contraste en cada superficie, nunca solo cambio de color |
| Lenguaje | “Service”, “Worship”, “Presenter” | Superficie de repertorio aún dice “Platform” en cuatro idiomas; captura por defecto en inglés | Inglés por defecto y nomenclatura histórica en otros diálogos | Español | Nombrar siempre los cuatro productos actuales; traducciones pueden cambiar idioma, pero no volver a “Platform” como nombre de producto |
| Estados | Persistencia/Worship/Presenter separados | Borrador local visible; toasts sobrepuestos al capturar | Salida de presentación visible, pero estado de importación en popup | Fixture vs preview importada visible | Estado, error y éxito deben describir hechos verificables y sobrevivir al contexto donde corresponda |
| Responsive | Shell con drawer a 390 px | Setlist se adapta, requiere captura móvil manual | Cabina desktop primero | Header + navegación inferior móvil | 390 px sin overflow para productos web; Presenter desktop conserva densidad de cabina |

## Correcciones concretas antes de cerrar E

1. Sustituir los cuatro tratamientos de marca por un monograma `LVM` y una etiqueta clara de producto, conservando las paletas propias. El activo canónico debe ser vectorial/textual, no un bitmap ni una dependencia de Figma.
2. Usar la misma pila tipográfica y los mismos valores base de espacio/radio/foco en los cuatro shells. Cada repo conserva sus propios tokens de implementación porque React y Svelte no comparten runtime ni paquetes.
3. Corregir en Worship la denominación visible “Platform” a “LVM Service” sin renombrar claves técnicas ni contratos `WorshipContext 0.1`/`WorshipPlan 0.1`.
4. Revisar en Presenter el encabezado, importación, estado de salida y menús de la demo. Su pantalla oscura actual es una cabina funcional, no el rediseño final; los cambios de E deben ser verificables en una captura posterior y no alterar el renderer de diapositivas.
5. Comparar en escritorio y móvil los estados loading, vacío, error, éxito y offline de Service, Worship y Web Pública. Registrar explícitamente lo que aún no existe para no declararlo uniforme por inferencia.
6. Repetir la demo después de los cambios visuales. Una diferencia estética intencional por producto es válida; una contradicción en marca, idioma, foco o estado no lo es.

## Evidencia revisada

- Service: `01-service-plan.png`, `03-service-import.png`, `04-service-presenter-handoff.png`, `service-mobile.png`.
- Worship: `02-worship-setlist.png` (desktop; la captura muestra el nombre del culto y tres canciones, pero también etiquetas antiguas “Platform”).
- Presenter: `05-presenter-slide.png` (proyecto importado, ocho elementos, Canción A y preview de slide).
- Web Pública: `web-desktop.png`, `web-mobile.png`, `web-import-desktop.png`, `web-import-mobile.png`.

Estas capturas son evidencia de la demo automatizada, no sustituyen una prueba manual de los cuatro productos ni prueban todos los estados de UI.
