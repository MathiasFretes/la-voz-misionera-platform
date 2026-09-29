# LVM Design System 0.1

Estado: **congelado — Design System 0.1**. La especificación visual ejecutable está en [Design Lab](../design-lab/README.md): [Dashboard](../design-lab/dashboard.html), [Editor](../design-lab/editor.html) y [tokens compartidos](../design-lab/tokens.css). MagicPath y Figma quedan como referencias de exploración; no son dependencias ni gates de implementación. Esta versión no cambia la UI productiva ni los contratos `WorshipPlan 0.1` y `Service 0.1`.

## Principios

1. **El culto es el centro.** El orden del servicio ocupa el área principal; integración y edición lo acompañan sin competir.
2. **La procedencia es visible.** Una canción llegada de Worship conserva una marca de origen. Platform controla su ubicación en el servicio; Worship controla su contenido musical.
3. **El estado local es explícito.** «Guardado en este navegador» describe persistencia local. No usar «sincronizado» para sugerir que existe sincronización por red.
4. **El dorado guía la acción.** Reservarlo para la acción principal, la pestaña activa y pequeños indicadores. Los estados de éxito, error y advertencia tienen colores semánticos propios.
5. **Una interfaz de trabajo, no una diapositiva.** Contraste, foco visible, teclado, textos legibles, estados vacíos y tamaños responsivos son parte del sistema.

## Color

Los valores siguientes están definidos en `design-lab/tokens.css`. La aplicación productiva debe consumir estos roles semánticos cuando se implemente la nueva UI.

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

Contraste verificado en el Design Lab: `#172033` sobre dorado **6.36:1**; texto secundario sobre blanco **7.69:1**; éxito **6.81:1**, advertencia **5.95:1** y error **6.05:1** sobre sus fondos. `#C89B3C` como texto sobre blanco da **2.56:1** y no sirve para texto normal; el dorado se usa como fondo de acción o indicador con texto navy.

Los componentes consumirán **roles semánticos**, no colores físicos. `design-lab/tokens.css` define `--lvm-bg-app`, `--lvm-bg-surface`, `--lvm-text-primary`, `--lvm-text-secondary`, `--lvm-border-subtle`, `--lvm-action-primary`, `--lvm-action-primary-hover` y los estados. Es el contrato visual 0.1; todavía no se añade al CSS productivo.

## Tipografía y escala

- Fuente de interfaz: **Inter** con fallback `system-ui, sans-serif`, aprobada provisionalmente. Una fuente distintiva para comunicación pública puede decidirse después sin cambiar la interfaz del software.
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
- Todos los contadores de la pantalla productiva deben derivar del mismo servicio. El Design Lab muestra 7 elementos de ejemplo de forma coherente.
- Exportar `Service 0.1` es una acción sobre un archivo local, no una publicación ni una conexión en vivo con Presenter.
- En la sidebar, mostrar solo rutas existentes. Ocultar Personas, Equipos y Contenido mientras no existan como módulos; una navegación deshabilitada requiere una razón visible y no debe parecer operativa.
- Copy del flujo por archivos: **Exportar contexto para Worship**, **Importar repertorio de Worship** y **Exportar para Presenter**. Evitar «Abrir / preparar en Worship» y «Preparar Presenter» mientras no existan deep links o integración directa.

## Motion 0.1

- 120–180 ms para hover, foco y selección; 180–240 ms para apertura de paneles y cambio de pestaña. Easing `ease-out` para entrada y `ease-in` para salida.
- En reordenamiento, animar la posición de filas y preservar la referencia del elemento tomado. El resultado debe ser comprensible sin animación.
- Evitar movimiento decorativo continuo. Respetar `prefers-reduced-motion: reduce` y desactivar desplazamientos no esenciales.
- Usar transiciones CSS para color, sombra, borde y opacidad. Reservar Motion for React para cambios de layout, reordenamiento, entradas/salidas, drawers y diálogos.

## Gate cumplido para 0.1

1. Dashboard y Editor usan la misma hoja de tokens, sidebar y barra/drawer móvil.
2. Se revisaron a 1440, 1024, 768 y 390 px: sin desbordamiento horizontal ni errores de ejecución; drawer móvil funcional en ambas páginas.
3. Los pares de texto, dorado y estados indicados arriba superan WCAG AA para texto normal.
4. El Editor conserva el orden como columna dominante y la tarjeta termina después de «Agregar elemento al culto». `Miércoles de oración` muestra que un servicio puede ser válido sin canciones.

La siguiente etapa es implementar Platform por capas: tokens → componentes base → shell → Dashboard → Editor → responsive → Motion. El producto seguirá usando `ServiceRepository`, `WorshipPlan` y `parseService()` como fuentes del dominio. Worship y Presenter permanecen fuera de este cambio.
