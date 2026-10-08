# M7.9E — Auditoría visual de la familia LVM

Estado: **auditoría y correcciones en curso**. La comparación usa las capturas de `docs/screenshots/m79d/`, la revisión manual del usuario del 2026-10-08 y las fuentes CSS actuales. M7.9D está cerrado funcionalmente; esta auditoría aún no congela el lenguaje visual.

| Dimensión | Service | Worship | Presenter | Web Pública | Decisión de familia |
| --- | --- | --- | --- | --- | --- |
| Rol | Administración, claro/navy | Música, oscuro/cyan | Cabina, oscuro/magenta | Editorial, navy/dorado/blanco | Mantener los cuatro roles distintos |
| Marca visible | `LV` en círculo dorado | `LVM` en recuadro dorado | Texto magenta “LVM Presenter” | Estrella en círculo dorado | Usar un monograma textual `LVM` coherente y nombre del producto separado; no usar la estrella genérica como logo |
| Base navy/dorado | Tokens `#0e1a2b` / `#c89b3c` | Tokens compartidos con esos valores | Base actual `#242832`, magenta `#f0008c` | Navy/dorado correctos | Navy y dorado son la marca; cyan y magenta quedan como acentos de producto, sin reemplazar estados semánticos |
| Tipografía | Inter → sistema | Sistema | Sistema | Arial | Pila compartida `Inter, system-ui, Segoe UI, sans-serif`; mantener tamaños de presentación configurables separados de UI |
| Espaciado/radio | Escala 4–48, controles 8, cards 12 | Escala 4–32, radio 10/12/16 | Reglas dispersas | Controles 8, varias cifras sueltas | Escala base 4/8/12/16/24/32/48, controles 8, tarjetas 12, paneles 16; cada app puede ajustar densidad |
| Foco | Estilo Design System | Token de foco propio | Magenta actual | `#bf8b27` fijo | Foco visible de 3 px con contraste en cada superficie, nunca solo cambio de color |
| Lenguaje | “LVM Service” | Español e inglés son idiomas admitidos; el repertorio ya nombra “LVM Service” en los cuatro locales presentes | Dispone de diccionario español y selector de idioma; `es-PY` se detectaba erróneamente como inglés al iniciar | Español | Cada locale debe ser coherente internamente; nombres de producto actuales en todos los idiomas |
| Estados | Persistencia/Worship/Presenter separados | Borrador local visible; toasts sobrepuestos al capturar | Salida de presentación visible, pero estado de importación en popup | Fixture vs preview importada visible | Estado, error y éxito deben describir hechos verificables y sobrevivir al contexto donde corresponda |
| Responsive | Shell con drawer a 390 px | Setlist se adapta, requiere captura móvil manual | Cabina desktop primero | Header + navegación inferior móvil | 390 px sin overflow para productos web; Presenter desktop conserva densidad de cabina |

## Correcciones concretas antes de cerrar E

1. Sustituir los cuatro tratamientos de marca por un monograma `LVM` y una etiqueta clara de producto, conservando las paletas propias. El activo canónico debe ser vectorial/textual, no un bitmap ni una dependencia de Figma.
2. Usar la misma pila tipográfica y los mismos valores base de espacio/radio/foco en los cuatro shells. Cada repo conserva sus propios tokens de implementación porque React y Svelte no comparten runtime ni paquetes.
3. Conservar los idiomas de Worship y la denominación visible “LVM Service” ya corregida, sin renombrar claves técnicas ni contratos `WorshipContext 0.1`/`WorshipPlan 0.1`. No se exige convertir Worship al español; sí evitar textos fijos fuera de i18n.
4. Revisar en Presenter el encabezado, importación, estado de salida y menús de la demo. Su diccionario español ya incluye los controles observados en inglés. El menú nativo duplicado de Windows se oculta por defecto también en desarrollo; los atajos siguen disponibles con Alt. La cabina mantiene su densidad y no se altera el renderer de diapositivas.
5. Comparar en escritorio y móvil los estados loading, vacío, error, éxito y offline de Service, Worship y Web Pública. Registrar explícitamente lo que aún no existe para no declararlo uniforme por inferencia.
6. Repetir la demo después de los cambios visuales. Una diferencia estética intencional por producto es válida; una contradicción en marca, idioma, foco o estado no lo es.

## Evidencia revisada

- Service: `01-service-plan.png`, `03-service-import.png`, `04-service-presenter-handoff.png`, `service-mobile.png`.
- Worship: `02-worship-setlist.png` (desktop; el nombre del culto y tres canciones están visibles). Las etiquetas antiguas “Platform” de esa captura ya fueron corregidas en la rama QA.
- Presenter: `05-presenter-slide.png` (proyecto importado, ocho elementos, Canción A y preview de slide).
- Web Pública: `web-desktop.png`, `web-mobile.png`, `web-import-desktop.png`, `web-import-mobile.png`.

Estas capturas son evidencia de la demo automatizada. La revisión manual posterior confirmó Presenter, Service y Web Pública; el repertorio independiente sin backend de Worship sigue como pendiente de pulido, registrado en `m79d-suite-demo.md`.

## Avance de corrección

- Los cuatro repositorios ya declaran los mismos valores navy, navy elevado, dorado y anillo de foco. `npm run test:design-language` lee las cuatro fuentes CSS y falla si divergen.
- Service y Web Pública muestran el monograma textual `LVM` en círculo dorado; Worship adoptó el mismo tratamiento en su shell; Presenter lo incorporó a la cabecera de cabina.
- Web Pública usa la misma pila tipográfica base que Service; Presenter también la declara, con fallback del sistema.
- Las cuatro traducciones de Worship conservan las claves técnicas existentes, pero nombran **LVM Service** en la interfaz.
- Presenter tiene diccionario español y selector de idioma. Se corrigió el primer inicio con `es-PY` y otros códigos regionales españoles, que antes caían al inglés. El idioma seleccionado manualmente no cambia. La comprobación pendiente es que el locale activo no mezcle idiomas.
- La captura nueva de Presenter, `LVM Presenter/docs/screenshots/m79e-presenter-desktop.png`, muestra el shell en español, un solo menú y el monograma visible. El control aislado confirmó `navigator.language=es-419`, menú nativo oculto y cierre sin proceso de prueba.
- Las capturas `docs/screenshots/m79e/` muestran Service, Worship y Web Pública a 1440/390 px sin overflow. `service-production-desktop.png` y `service-production-mobile.png` comprueban que Contract Inspector no aparece en el shell de producción.
- Los estados de error del cancionero/repertorio/lectura de Worship están registrados en `docs/screenshots/m79d/`. La vista de repertorios guardados necesita backend o sesión; en la demo local el borrador sigue accesible. El término `Palabra del día` es la etiqueta revisada del locale español para una utilidad de lectura bíblica; no es el CMS de Service.
- Falta revisar de forma conjunta los estados loading/vacío/error/éxito/offline de todas las vistas relevantes y repetir el recorrido de integración después del pulido visual. Por ello M7.9E permanece abierto.
