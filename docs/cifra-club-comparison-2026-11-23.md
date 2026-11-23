# Cifra Club frente a LVM Worship

Inspección manual del 23 de noviembre de 2026 mediante Computer Use en Brave,
sin autenticar una cuenta. Referencia:
https://www.cifraclub.com/steve-green/cuan-gloriosa-sera-la-manana/tpwtts.html

## Evidencia funcional

| Herramienta                        | Resultado observado                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tono                               | Mi → Fa mediante +1/2 tono; restablecido a Mi.                                                                                                             |
| Capo                               | Segundo traste: Fa♯ con forma de Mi; cambian los diagramas y aparece `capo=2` en la URL. Restablecido sin capo.                                            |
| Afinación                          | Medio tono abajo: distingue sonido y forma del acorde, actualiza diagramas y añade el parámetro de afinación. Restablecida a estándar.                     |
| Diagramas                          | Guitarra → teclado reemplaza los trastes por teclas. Restaurada guitarra. Ukulele, cavaco y viola caipira aparecen como opciones; no probadas.             |
| Texto                              | Arrastrar el control aumenta letra y acordes; alineación visual conservada. Aviso de ajustes guardados para todas las canciones. Restablecido a 100 %.     |
| Cifrado                            | A–B–C → Do–Re–Mi cambia acordes de la letra y diagramas. Restaurado el cifrado americano.                                                                  |
| Desplazamiento                     | El estándar desplaza la página y ofrece control de velocidad. La modalidad inteligente figura como PRO; no probada. Se cerró el control de desplazamiento. |
| Columnas                           | Ofrece pantalla normal/completa y dimensiones de columna. Elegir pantalla normal abre ingreso de cuenta: resultado de columnas no validado.                |
| Descarga                           | Abre ingreso de cuenta; ningún archivo descargado.                                                                                                         |
| Tablaturas y rasgueos              | Cada menú ofrece mostrar/omitir. Esta versión no ofrece contenido visible suficiente para demostrar el efecto; no se certifica su funcionamiento.          |
| Audio, vídeo, afinador y metrónomo | Controles/enlaces presentes. No se certifica reproducción, captura de micrófono ni funcionamiento de páginas externas.                                     |

No se crearon cuentas, no se ingresaron credenciales, no se compraron planes
y no se enviaron correcciones ni publicaciones. Los ajustes musicales modificados
se restauraron. No se transcribió la letra de la canción.

## CSS computado verificado

Leído en Elements → Computed de DevTools del navegador del usuario, sin ejecutar
JavaScript en la consola. Ventana de aproximadamente 1336 × 810 píxeles lógicos;
DevTools acoplado reduce el ancho del documento. Los tamaños siguientes describen
ese estado, no todos los breakpoints.

| Elemento / propiedad                           | Valor observado                                        |
| ---------------------------------------------- | ------------------------------------------------------ |
| `body` fondo                                   | `rgb(27, 27, 27)` / `#1b1b1b`                          |
| `body` texto                                   | `rgb(241, 241, 241)` / `#f1f1f1`                       |
| `body` fuente                                  | `Roboto, "Helvetica Neue", Arial, sans-serif`          |
| `body` tamaño / interlineado                   | `14px` / `20px`                                        |
| Letra musical, familia                         | `"Roboto Mono", "Courier New", Courier, monospace`     |
| Letra musical, tamaño / peso / interlineado    | `14px` / `400` / `22.4px`                              |
| Acorde, color                                  | `rgb(255, 136, 34)` / `#ff8822`                        |
| Acorde, familia / tamaño / peso / interlineado | Roboto Mono y alternativas / `14px` / `700` / `22.4px` |

El estrechamiento por DevTools activó un diseño con barra inferior y un aviso
para usar la aplicación. Se eligió continuar en el sitio. Esto acredita adaptación
al ancho del documento; no sustituye una prueba en teléfono físico. DevTools quedó
cerrado al terminar.

## Comparación con el código de LVM

Cliente revisado: `5cd6845fb77e8e8643fe4c0a02705c8143fb27b3` de LVM Worship.
La columna LVM se basa en código, no en una nueva prueba integral de su UI.

| Área                                 | LVM existente                                                                                            | Diferencia relevante                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Canción                              | Transposición, acordes visibles/ocultos, una/dos columnas, favoritos/repertorios y exportaciones         | Cifra concentra más herramientas de práctica junto a la letra.                                              |
| Interpretación                       | Worship Mode: fuente, columnas, pantalla completa, reloj y navegación                                    | Cifra ofrece autodesplazamiento estándar en la ficha.                                                       |
| Capo                                 | Metadato mostrado/exportado en SongView                                                                  | Falta ajuste interactivo equivalente en esa vista.                                                          |
| Diagramas, afinación, cifrado latino | Sin equivalentes integrados encontrados en SongView                                                      | Brechas concretas de práctica instrumental.                                                                 |
| Afinador y metrónomo                 | Implementados en PracticeToolsPage                                                                       | Herramientas existentes, ubicadas en otra pantalla.                                                         |
| Tablatura / partitura / mezcla       | Páginas dedicadas                                                                                        | No equivale a mostrar u omitir contenido incrustado.                                                        |
| Sistema visual                       | Fondo oscuro `#0f1729`, superficies azul marino y acento dorado; letra Noto Sans, acordes Noto Sans Mono | Cifra usa fondo neutro y una misma familia monoespaciada para letra/acordes, con color de acorde explícito. |

Archivos revisados en LVM Worship: `apps/web/src/pages/SongViewPage.jsx`,
`apps/web/src/pages/WorshipModePage.jsx`,
`apps/web/src/features/practice/PracticeToolsPage.jsx`,
`apps/web/src/components/song/SongChartLines.jsx`,
`apps/web/src/components/song/ChordRender.jsx`,
`apps/web/src/styles/base.css` y `packages/tokens/tokens.css`.

## Decisión y límites

La recomendación es conservar la identidad azul/dorado de LVM y organizar mejor
las herramientas existentes, haciendo explícito el color de los acordes. Los
diagramas, capo interactivo, afinación y desplazamiento son candidatos posteriores;
esta revisión no los implementa ni autoriza ampliar funcionalidades antes de
cerrar el gate nativo. No se modificó ni publicó la aplicación de producción.
