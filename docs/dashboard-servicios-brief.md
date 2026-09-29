# M7.5 — Dashboard / Servicios: brief de diseño

Estado: **concepto validado en [Design Lab](../design-lab/dashboard.html)**; aún no es una pantalla productiva. Comparte los fundamentos de [Design System 0.1](design-system-0.1.md) con el Editor de Servicio.

## Objetivo

Ayudar a encontrar o crear un servicio en pocos segundos. La pantalla representa solo datos que Platform ya guarda localmente: nombre, fecha/hora, sede, elementos del orden y repertorio importado. No incluir gráficos, métricas, personas asignadas ni actividad reciente.

## Contenido principal — con servicios

```text
LVM Platform                                      [ + Crear servicio ]
Servicios
Tus cultos están guardados en este navegador.

PRÓXIMO SERVICIO
Culto General
Domingo · 19:00 · Sede Central
[ Abrir servicio ]

SERVICIOS RECIENTES
Culto General               [Listo para Presenter]      [Abrir]
Miércoles de oración       [Repertorio pendiente]       [Abrir]
Reunión juvenil            [Guardado localmente]        [Abrir]

ESTADO LOCAL
Datos guardados en este navegador
```

Los nombres son datos de ejemplo del prototipo. Fecha/hora proviene de `service.startsAt` y sede de `ServiceRecord.venue`; la sede es metadata local y no se agrega a `Service 0.1`. «Próximo servicio» es el servicio futuro con fecha más cercana; si no existe, ocultar ese bloque y mantener visibles los recientes.

## Estados obligatorios del diseño

| Estado               | Contenido y acción                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Con servicios        | Próximo servicio, recientes y CTA «Crear servicio»                                                                                           |
| Sin servicios        | Mensaje «Todavía no hay servicios», explicación breve y CTA «Crear servicio»                                                                 |
| Listo para Presenter | Badge «Service 0.1 válido» solo si el servicio completo supera la misma validación usada al exportar; acción «Abrir servicio»                |
| Repertorio pendiente | Badge «Repertorio pendiente» cuando no se importó un WorshipPlan para ese servicio; esto no implica por sí solo que Service 0.1 sea inválido |
| Guardado local       | Nota persistente «Datos guardados en este navegador»; no sugerir sincronización remota                                                       |
| Responsive           | Escritorio, tablet y móvil; las mismas acciones permanecen accesibles                                                                        |

Los estados de **guardado local**, **repertorio importado** y **validez para Presenter** son independientes. Una tarjeta puede comunicar más de uno mediante texto breve, sin acumular badges ambiguos. Los contadores, cuando se muestren, se derivan de `service.items` y nunca de datos decorativos independientes.

## Estructura e interacción

- Sidebar navy con marca LVM y solo destinos existentes: inicio, servicios y las rutas reales del producto. No mostrar Personas, Equipos ni Contenido como si estuvieran disponibles.
- Encabezado claro con una sola acción principal dorada: «Crear servicio».
- «Próximo servicio» tiene mayor jerarquía que «Servicios recientes», pero no necesita un gráfico ni cifras agregadas.
- Cada fila o tarjeta de servicio tiene título, fecha/hora, sede cuando existe, estado y acción «Abrir servicio». La tarjeta puede ser clicable si conserva una acción visible y foco de teclado.
- Estado vacío centrado dentro del área de contenido, con lenguaje directo y sin ilustraciones que compitan con la acción.
- En móvil, sidebar como drawer; próximo servicio y recientes en una columna. La acción de crear permanece visible sin tapar contenido.
- Hover/focus/pressed de botones y filas siguen el Design System 0.1. La navegación entre pantallas no necesita una animación ornamental.

## Copy que evita prometer integración inexistente

| Evitar                        | Usar                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- |
| «Sincronizado»                | «Guardado en este navegador»                                                     |
| «Preparar Presenter»          | «Exportar para Presenter» en el Editor                                           |
| «Abrir / preparar en Worship» | «Exportar contexto para Worship» / «Importar repertorio de Worship» en el Editor |

## Criterios de revisión

1. Dashboard y Editor parecen partes de la misma suite por color, tipografía, radios, botones, sidebar y estados.
2. Los estados con servicios, vacío, listo, pendiente y local se entienden sin explicación externa.
3. En escritorio y móvil se puede localizar, abrir o crear un servicio sin perder el estado local.
4. El contraste AA y el foco de teclado funcionan en acciones, texto secundario y badges.
5. Los ejemplos no agregan capacidades fuera del dominio actual de Platform.

La revisión de coherencia y responsive se completó en el Design Lab. La implementación productiva debe derivar los estados del dominio real, no de los datos de ejemplo de esta página.
