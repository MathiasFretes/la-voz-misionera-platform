# M7.x — Gate final de la suite

**Estado:** baseline funcional integrado en `main` y verificado el 2026-10-09. M8A puede comenzar sobre los contratos 0.1. Esta aprobación no equivale a una publicación de producción de las cuatro aplicaciones.

## Revisiones integradas

| Producto        | PR                                                                      | Commit de `main` comprobado |
| --------------- | ----------------------------------------------------------------------- | --------------------------- |
| LVM Service     | [#7](https://github.com/MathiasFretes/la-voz-misionera-platform/pull/7) | `63f888f`                   |
| LVM Worship     | [#3](https://github.com/MathiasFretes/lvm-worship/pull/3)               | `db8483605`                 |
| LVM Presenter   | [#2](https://github.com/MathiasFretes/lvm-presenter/pull/2)             | `5c08855`                   |
| LVM Web Pública | [#1](https://github.com/MathiasFretes/lvm-web-publica/pull/1)           | `007b896`                   |

## Evidencia funcional desde `main`

| Gate                                                   | Resultado                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service: unitarios, lint y build                       | 20/20, lint y build correctos.                                                                                                                                                     |
| Worship Web: unitarios, lint, i18n y build de preview  | 484/484, lint, traducciones y build correctos.                                                                                                                                     |
| Worship Mobile: unitarios, TypeScript y bundle Android | 902/902, `tsc --noEmit` y `export:android` correctos.                                                                                                                              |
| Worship Studio: tokens Swift                           | `tokens:swift:check` correcto; no equivale a ejecución nativa en macOS.                                                                                                            |
| Presenter: contrato Service y build global             | 5/5 tests de `test:lvm`; frontend, servidores y Electron compilaron.                                                                                                               |
| Web Pública: unitarios y build normal                  | 4/4 y build correctos; el build normal no incluye el cargador de previews.                                                                                                         |
| Service → Worship → Service → Presenter                | Pasó offline con el checkout de Presenter en `5c08855` (mismo commit de `main`).                                                                                                   |
| Service → Web Pública                                  | Pasó con el build de preview y datos de archivo.                                                                                                                                   |
| Responsive web 768/1024 px                             | Pasó en Service, Worship y Web: sin overflow, foco visible, botón de menú táctil y movimiento reducido.                                                                            |
| Identidad V0 compartida                                | Pasó el verificador de marca para Service, Worship Web/Mobile/Studio, Presenter y Web Pública. Las referencias desktop/390 px están en [la revisión visual](m79e-v0-visual-qa.md). |

La primera ejecución de la demo completa desde el checkout principal de Presenter falló al localizar `#output_window_button` después de importar un servicio. El mismo flujo pasó en una segunda ejecución usando otro checkout limpio del **mismo commit `5c08855`**. No se identificó la causa del fallo inicial; el resultado se conserva como señal para el siguiente QA interactivo de Presenter. No se repitieron benchmarks NDI.

## Contratos congelados como baseline de M8A

- `WorshipContext 0.1`: contexto que Service entrega a Worship.
- [`WorshipPlan 0.1`](../contracts/worship-plan-0.1.md): repertorio que Worship devuelve a Service.
- [`Service 0.1`](../contracts/service-0.1.md): orden completo que Presenter valida e importa.
- [`PublicContent 0.1`](../contracts/public-content-0.1.md): contenido que Service entrega a la Web Pública.

Los contratos se conservan versionados. M8A puede agregar PostgreSQL, API, migraciones y repositorios detrás de estos límites; cualquier cambio de esquema de intercambio requiere su propia versión y migración.

## Límites de este gate

- Worship Web/Mobile aún necesitan un entorno de datos QA para verificar catálogos, repertorios y pantallas autenticadas con contenido real. El flujo offline de archivos y los estados recuperables sí están cubiertos.
- Studio no tuvo revisión visual nativa en macOS; se verificaron tokens Swift, recursos y generación reproducible.
- Web Pública sigue en preview de contenido; publicación real, CMS y datos administrados pertenecen a fases posteriores.
- Presenter M7.8F conserva el defecto conocido de limpieza de dos claves de registro en el desinstalador NSIS. La instalación pública firmada y la prueba en una PC limpia siguen siendo gates de release, separados de esta demo.
- El modo oscuro completo queda para una fase posterior. Los cuatro productos ya comparten identidad navy/dorado/blanco y roles semánticos.

Las evidencias y comandos de reproducción están en [la demo integral](m79d-suite-demo.md) y [la revisión visual V0](m79e-v0-visual-qa.md).
