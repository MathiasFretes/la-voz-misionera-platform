# M7.9E — revisión de identidad V0

**Estado:** en curso. Las ramas de revisión usan la identidad única de La Voz Misionera; todavía no se autorizó su integración a `main` ni el cierre de E6/E7.

## Evidencia inicial

| Producto    | Desktop                                                      | Móvil                                                                                                       | Comprobación de esta pasada                                                                           |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Service     | [1440 px](screenshots/m79e-v0/service-desktop.png)           | [390 px](screenshots/m79e-v0/service-mobile.png)                                                            | Inicio con tokens V0 y marca; tests, lint y build                                                     |
| Worship     | [1440 px](screenshots/m79e-v0/worship-desktop.png)           | [390 px ES](screenshots/m79e-v0/worship-mobile.png), [390 px EN](screenshots/m79e-v0/worship-mobile-en.png) | 484 tests, lint, i18n y build; sin overflow a 390 px                                                  |
| Presenter   | [Windows desktop](screenshots/m79e-v0/presenter-desktop.png) | [1024 px](screenshots/m79e-v0/presenter-1024.png)                                                           | Cabecera real sin DevTools ni menú duplicado; cierre del proceso; build frontend y tests del contrato |
| Web Pública | [1440 px](screenshots/m79e-v0/web-desktop.png)               | [390 px](screenshots/m79e-v0/web-mobile.png)                                                                | 4 tests, 3 E2E, build; sin overflow                                                                   |

La Web usa el mismo recurso local `hero-comunidad.webp` en ambos anchos. Se comprobó que la imagen carga y tiene 1672 px de ancho intrínseco tanto a 1440 como a 390 px. El recorte distinto responde a `background-size: cover`, no a una imagen ni un hero alternativo. El build público normal muestra una pantalla de preparación mientras no haya contenido publicado por Service; las rutas de demostración solo aparecen en `build:preview` o desarrollo.

La repetición integral posterior a los cambios V0 pasó el 2026-10-08: `npm run test:demo` validó Service → Worship → Service → Presenter y Service → Web Pública sin red externa. El runner usa `build:preview` de Web Pública para verificar el intercambio; el build público normal permanece sin fixtures. La primera invocación se detuvo porque había servidores manuales ocupando los puertos de Playwright; se cerraron y la corrida en el entorno previsto terminó con código 0.

La segunda pasada incluyó [Servicios](screenshots/m79e-v0/service-list.png), [Editor](screenshots/m79e-v0/service-editor.png), [Editor móvil](screenshots/m79e-v0/service-editor-mobile.png), [Canciones](screenshots/m79e-v0/worship-songs.png), [Canciones móvil](screenshots/m79e-v0/worship-songs-mobile.png), [Repertorio](screenshots/m79e-v0/worship-setlist.png) y [Lectura bíblica](screenshots/m79e-v0/worship-reading.png). Las siete vistas no presentan overflow en el ancho observado. Se corrigió el título `LVM Platform` de la pestaña Service, los metadatos de Songs/Reading según locale y el estado de error visual de Lectura. Las capturas de Canciones muestran la carga inicial con el backend de demostración inactivo; no prueban una biblioteca con datos remotos ni el estado de error posterior.

La [captura del servicio importado en Presenter](screenshots/m79d/05-presenter-slide.png) confirma que los bordes de selección de la diapositiva y las salidas usan dorado LVM. El primer intento conservaba magenta en una salida predeterminada guardada; Presenter migra únicamente ese color heredado y conserva los colores personalizados. El E2E offline del recorrido Service → Worship → Service → Presenter volvió a pasar tras la corrección. El arnés elige inglés para el onboarding de Presenter; eso no representa una mezcla de idiomas dentro de un locale.

La cabina de Presenter también se abrió a 1024 px: el documento no desborda horizontalmente, la guía de inicio se omitió antes de capturar y el título inicial cabe en el panel central. El arnés cerró Electron y eliminó su perfil temporal. Esto verifica la pantalla inicial a ese ancho; no equivale a una revisión de todos los paneles de edición de Presenter.

En Worship, la [biblioteca sin backend a 390 px](screenshots/m79e-v0/worship-songs-error-390.png) pasó del estado de carga a un aviso recuperable con botón de reintento. No aparece la excepción técnica y no hay overflow. La vista está en inglés porque ese es el locale del perfil de prueba; las cadenas vienen de i18n. Los tests de `SongsPage` cubren también carga, vacío y lista con canciones mediante datos controlados. No se afirma que la biblioteca remota funcione sin un entorno QA.

La revisión intermedia a [768 px](screenshots/m79e-v0/service-768.png) y [1024 px](screenshots/m79e-v0/service-1024.png) de Service, [768 px](screenshots/m79e-v0/worship-768.png) y [1024 px](screenshots/m79e-v0/worship-1024.png) de Worship, y [768 px](screenshots/m79e-v0/web-768.png) y [1024 px](screenshots/m79e-v0/web-1024.png) de Web Pública no encontró overflow horizontal. El control automatizado verifica foco visible por teclado, un área táctil de 44 × 44 px para los tres botones de menú y duración reducida de transiciones al solicitar menos movimiento. El acento de texto sobre blanco ahora usa `--lvm-gold-text-on-light`, que alcanza 6,01:1; sobre navy se conserva `brand.gold` con 6,01:1. En Presenter el movimiento reducido se limita al shell de operación para no alterar el tiempo de la proyección.

## Lo que falta antes del gate

- Completar la revisión de estados loading, vacío, error y éxito con datos reales de Service/Worship; el error de Songs ya está capturado, pero el backend de demostración está inactivo.
- Revisar foco y estados de contraste adicionales en los flujos completos y los paneles de edición de Presenter a 1024 px. El control de 768/1024, foco, targets táctiles y movimiento reducido de las tres interfaces web ya pasó.
- Repetir una sola vez la demo integral desde las ramas actualizadas y revisar los diffs y CI de los PR borrador.

El verificador `scripts/verify-design-language.mjs` comprueba los valores de marca compartidos en los cuatro repositorios. M7.9F mapeará después estos tokens a los temas claro y oscuro; no se implementa un segundo diseño en este gate.
