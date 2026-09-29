# LVM Platform Design Lab 0.1

El navegador es la referencia visual ejecutable de [Dashboard](dashboard.html) y [Editor de Servicio](editor.html). Abre [index.html](index.html) directamente; no se necesita servidor, cuenta ni Internet. Las páginas usan [tokens.css](tokens.css) y [styles.css](styles.css), sin Tailwind ni dependencias de MagicPath o Figma.

## Alcance

- Las vistas de 1440, 1024, 768 y 390 px comparten `AppSidebar`, el shell móvil, botones, tarjetas, campos, tabs y estados.
- Persistencia, Worship y Presenter se presentan como dimensiones independientes. La canción manual muestra origen Platform; las importadas muestran Worship. `Miércoles de oración` muestra un Service válido sin canciones.
- Los datos y botones de edición son ejemplos visuales. No guardan, importan ni exportan. La aplicación real seguirá usando `ServiceRepository`, `WorshipPlan 0.1` y `parseService()` para determinar estados y operaciones.
- Figma y MagicPath quedan como referencias históricas. No son un gate para iterar o implementar este sistema.

## Gate de Design System 0.1

1. Editor y Dashboard comparten tokens, sidebar, shell móvil y estados.
2. No hay desbordamiento horizontal entre 390 y 1440 px.
3. Los pares de texto principales, dorado y estados cumplen contraste WCAG AA.
4. El Editor conserva el orden como columna dominante; su tarjeta termina tras «Agregar elemento al culto».

Tras pasar el gate, congelar `docs/design-system-0.1.md`. La UI productiva de Platform se implementará en otra rama por capas: tokens, componentes base, shell, Dashboard, Editor, responsive y, al final, Motion.
