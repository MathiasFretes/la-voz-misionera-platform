# LVM Design Language 0.1 — identidad unificada desde V0

**Estado:** implementación de M7.9E en revisión visual; E6/E7 siguen abiertos. La decisión del usuario del 2026-10-08 reemplaza la propuesta de paletas independientes. V0 (`C:\la-voz-misionera-v0`) es referencia visual de solo lectura: se toman decisiones de marca y UX, no Expo, NativeBase, Firebase ni componentes antiguos.

## Evidencia V0 y decisiones

La fuente de valores es `src/constants/design.ts` de V0, contrastada con `src/theme/tokens.ts` y las capturas `docs/v0/screenshots/inicio-desktop.jpg` e `inicio-mobile.jpg`. La cabecera original en `src/navigation/NavbarDesktop.tsx` muestra una cruz blanca dentro de un círculo dorado y el nombre **La Voz Misionera**, con “Misionera” en dorado. La fuente del original es Poppins, cargada allí desde Google Fonts; la suite nueva debe empaquetarla localmente para mantener la demo offline.

| Token objetivo    | Valor V0  | Uso                                              |
| ----------------- | --------- | ------------------------------------------------ |
| `brand.navy`      | `#1c2a39` | Texto principal, superficies oscuras y cabeceras |
| `brand.gold`      | `#c6a15b` | Acento y acción primaria                         |
| `brand.goldLight` | `#e2c58a` | Énfasis sobre navy                               |
| `brand.goldDark`  | `#b48f4a` | Variación de interacción                         |
| `background`      | `#f6f7f9` | Fondo claro                                      |
| `surface`         | `#ffffff` | Tarjetas y paneles                               |
| `text`            | `#2d3748` | Cuerpo de texto                                  |
| `border`          | `#e4e7ec` | Separadores suaves                               |
| `churchBlue`      | `#3e6ba5` | Apoyo puntual, no marca alternativa              |

La tipografía de interfaz y titulares será **Poppins** con respaldo del sistema. La escala de espaciado parte de 4 px (`4, 8, 16, 24, 32, 48`); V0 usa radio pequeño de 8 px y radio principal de 14 px. Conservamos los mínimos de accesibilidad del sistema actual: foco visible, controles táctiles de al menos 44 px y reducción de movimiento. Los colores semánticos de éxito, advertencia y error se validan por contraste antes de congelarlos; el acento dorado no sustituye esos estados.

`brand.gold` se mantiene en `#c6a15b` para fondos, bordes y texto sobre navy (6,01:1). Sobre blanco solo alcanza 2,43:1; el texto dorado pequeño en superficies claras usa `--lvm-gold-text-on-light: #825c18` (6,01:1 sobre blanco). El foco usa `#b4872e` (3,26:1 sobre blanco). Son roles de contraste, no paletas nuevas de producto.

## Una marca, cuatro funciones

Service, Worship, Presenter y Web Pública usarán **navy + dorado + blanco** como identidad común. El encabezado combinará la marca de La Voz Misionera con el nombre del producto. Se distinguirán por función, iconos, contenido y densidad, sin convertir cyan o magenta en marcas separadas. La Web Pública y las capturas V0 son la referencia visual; Service ya está más cerca y Presenter conservará la distribución de cabina al adoptar los nuevos tokens.

La marca anterior de la demo —monograma textual `LVM` dentro de círculo dorado— se sustituye por la cruz y el nombre **La Voz Misionera** en las superficies migradas. La cruz se dibuja con CSS propio; no copiamos el componente React Native de V0. Las imágenes remotas del hero V0 no se trasladan sin verificar procedencia y derechos de uso. La UI de contenido proyectado, acordes y diapositivas no hereda automáticamente la fuente ni los colores del shell.

## Tokens semánticos y tema futuro

Los componentes deberán consumir roles (`--lvm-bg`, `--lvm-surface`, `--lvm-text`, `--lvm-primary`, `--lvm-accent`, `--lvm-border`, `--lvm-success`, `--lvm-warning`, `--lvm-error`) en vez de valores directos. El tema **claro** es el objetivo de M7.9E. M7.9F preparará el mapeo semántico claro/oscuro; el modo oscuro completo en los cuatro productos queda para una fase posterior. Presenter puede conservar una cabina oscura mientras se migra, pero su tema final será el oscuro de LVM con navy/dorado, no una identidad magenta independiente.

## Gates

1. **E1:** esta especificación y una comparación visual verificable con V0.
2. **E2–E5:** aplicar identidad a Service, Worship, Presenter y Web Pública por superficies, sin alterar contratos 0.1 ni comportamiento de presentación. Mantener ES/EN de Worship y los demás locales existentes.
3. **E6:** 1440 y 390 px, foco, contraste, estados de carga/vacío/error/éxito y movimiento reducido.
4. **E7:** capturas comparativas de los cuatro productos y demo integral; sólo entonces aprobar el merge de M7.9E.

Las capturas de `docs/screenshots/m79e/` documentan la propuesta previa de paletas separadas. La evidencia de la identidad V0 unificada está en `docs/m79e-v0-visual-qa.md` y `docs/screenshots/m79e-v0/`.
