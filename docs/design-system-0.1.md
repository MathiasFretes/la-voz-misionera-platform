# LVM Design System 0.1 — borrador de fundamentos

Estado: **propuesto para revisión visual**. Este documento describe la pantalla pública [LVM Platform — Editor de Servicio](https://designs.magicpath.ai/v1/fresh-valley-5681) y fija reglas para diseñar Dashboard / Servicios. No cambia la UI productiva ni los contratos `WorshipPlan 0.1` y `Service 0.1`.

## Principios

1. **El culto es el centro.** El orden del servicio ocupa el área principal; integración y edición lo acompañan sin competir.
2. **La procedencia es visible.** Una canción llegada de Worship conserva una marca de origen. Platform controla su ubicación en el servicio; Worship controla su contenido musical.
3. **El estado local es explícito.** «Guardado en este navegador» describe persistencia local. No usar «sincronizado» para sugerir que existe sincronización por red.
4. **El dorado guía la acción.** Reservarlo para la acción principal, la pestaña activa y pequeños indicadores. Los estados de éxito, error y advertencia tienen colores semánticos propios.
5. **Una interfaz de trabajo, no una diapositiva.** Contraste, foco visible, teclado, textos legibles, estados vacíos y tamaños responsivos son parte del sistema.

## Color

Los valores base se observaron en el CSS compilado del prototipo público. La asignación semántica siguiente es una propuesta para la suite; requiere verificación de contraste antes de implementarse.

| Token semántico          | Valor inicial | Uso                                     |
| ------------------------ | ------------- | --------------------------------------- |
| `color.brand.navy`       | `#0E1A2B`     | Sidebar y superficies de identidad      |
| `color.brand.navyRaised` | `#172033`     | Elementos elevados en navegación oscura |
| `color.brand.gold`       | `#C89B3C`     | Acción principal y selección            |
| `color.brand.goldTint`   | `#FFF9ED`     | Selección tenue y origen Worship        |
| `color.surface.canvas`   | `#F7F9FC`     | Fondo de trabajo claro                  |
| `color.surface.card`     | `#FFFFFF`     | Tarjetas y formularios                  |
| `color.text.primary`     | `#172033`     | Títulos y contenido principal           |
| `color.text.secondary`   | `#475467`     | Metadatos y ayudas                      |
| `color.border.subtle`    | `#E1E6EF`     | Divisores y contornos                   |

Definir aparte `success`, `warning` y `danger` con pares fondo/texto que alcancen WCAG AA. No usar solo color para expresar estado. En superficie dorada, elegir texto oscuro según contraste medido; evitar blanco por defecto.

## Tipografía y escala

- Fuente de trabajo: **Inter** con fallback `system-ui, sans-serif`, pendiente de confirmar como decisión de marca. El CSS público importa Inter; no se observa aún una familia distintiva de títulos.
- Escala inicial: 12 / 14 / 16 / 20 / 24 / 32 px. Cuerpo 16 px; metadatos 14 px; 12 px solo para etiquetas auxiliares con contraste suficiente.
- Pesos: 400 para cuerpo, 600 para controles y subtítulos, 700 para títulos. Reservar mayúsculas con tracking ligero para etiquetas cortas como «ORDEN DEL CULTO».
- Los títulos y nombres de canciones pueden ocupar dos líneas antes de truncarse. No esconder referencias bíblicas importantes tras puntos suspensivos.

## Espacio, forma y elevación

| Grupo     | Escala inicial                    | Regla                                                     |
| --------- | --------------------------------- | --------------------------------------------------------- |
| Espaciado | 4 / 8 / 12 / 16 / 24 / 32 / 48 px | Base de 4 px; 24–32 px entre secciones principales        |
| Radios    | 8 / 12 / 16 px                    | 8 controles, 12 tarjetas pequeñas, 16 paneles principales |
| Bordes    | 1 px                              | Separar filas y tarjetas antes de usar sombra             |
| Sombras   | Suave / elevada                   | Suave para tarjetas; elevada solo para menús y diálogos   |

El prototipo usa sombras suaves cercanas a `0 8px 30px #1720330D`. No convertir cada fila del orden en una tarjeta flotante: la lista debe leerse como una secuencia.

## Componentes 0.1

| Componente          | Anatomía y variantes mínimas                                  | Comportamiento                                                       |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `AppSidebar`        | Marca LVM, navegación, sección activa, pie de estado          | Colapsa a navegación compacta; en móvil se abre bajo demanda         |
| `PageHeader`        | Contexto, título, fecha/sede, guardado local, acción primaria | El estado de guardado usa texto, no solo icono                       |
| `Tabs`              | Orden / Información / Presentación                            | Indicador dorado, `aria-selected`, flechas y foco visibles           |
| `Button`            | Primary gold, secondary outlined, tertiary text, destructive  | Hover, focus, pressed, loading y disabled; objetivo táctil ≥ 44 px   |
| `Field`             | Etiqueta, control, ayuda y error                              | Error asociado al campo; no depender del placeholder                 |
| `Card`              | Encabezado, contenido y acciones opcionales                   | Jerarquía por borde/espacio, sombra moderada                         |
| `Badge`             | Origen Worship, local, listo, pendiente, error                | Texto legible; color solo como refuerzo                              |
| `ServiceItem`       | Número, tipo, título, detalle, origen y controles de orden    | Selección, foco, arrastre y alternativa Subir/Bajar por teclado      |
| `IntegrationStatus` | Producto, estado, descripción y siguiente acción              | Distingue «archivo importado localmente» de sincronización remota    |
| `EmptyState`        | Qué falta, por qué importa y una acción                       | Casos: sin servicios, orden vacío, repertorio vacío, sin exportación |
| `LoadingState`      | Mensaje y progreso cuando aplique                             | Evitar loaders indefinidos para operaciones locales rápidas          |

## Reglas del Editor de Servicio

- La columna de orden sigue siendo dominante en escritorio; el panel de edición es secundario. En pantallas angostas, el panel pasa debajo de la lista o a un drawer, manteniendo contexto de selección.
- Las canciones importadas muestran `Worship` y pueden reordenarse dentro del servicio. Sus letras, acordes, tonalidad y arreglo se editan en Worship. Platform muestra esos datos como referencia de solo lectura y ofrece una acción clara para volver a Worship.
- Las canciones manuales conservan su identidad y no adquieren la marca Worship por estar junto a una canción importada.
- Mostrar estados separados para **guardado local**, **repertorio importado** y **Service 0.1 válido para Presenter**. Son hechos distintos.
- Todos los contadores de la pantalla deben derivar del mismo servicio. El prototipo público muestra 7 elementos en «Orden» y 8 en «Presentación»; corregirlo antes de tomar capturas finales o implementar.
- Exportar `Service 0.1` es una acción sobre un archivo local, no una publicación ni una conexión en vivo con Presenter.

## Motion 0.1

- 120–180 ms para hover, foco y selección; 180–240 ms para apertura de paneles y cambio de pestaña. Easing `ease-out` para entrada y `ease-in` para salida.
- En reordenamiento, animar la posición de filas y preservar la referencia del elemento tomado. El resultado debe ser comprensible sin animación.
- Evitar movimiento decorativo continuo. Respetar `prefers-reduced-motion: reduce` y desactivar desplazamientos no esenciales.
- Motion for React se incorpora al implementar interacciones que lo necesiten; no hace falta para cambios simples de color o borde.

## Validación antes de congelar 0.1

1. Confirmar en MagicPath la tipografía final, los tokens de estado y la variante responsiva de sidebar.
2. Medir contraste de texto dorado, badges y metadatos en todos sus fondos.
3. Corregir el contador 7/8 y el texto «sincronizado localmente» del prototipo.
4. Confirmar el tratamiento de canciones gestionadas por Worship como referencia de solo lectura en Platform.
5. Diseñar **Dashboard / Servicios** en un frame independiente, reutilizando los tokens y componentes anteriores. Debe incluir servicio reciente, CTA «Crear servicio», estado local, lista vacía y al menos un servicio listo para Presenter.
6. Comparar Editor y Dashboard en escritorio y móvil; luego consolidar en Figma y recién entonces llevar los tokens al CSS productivo.
