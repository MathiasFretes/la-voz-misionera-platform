# M7.9E — revisión de identidad V0

**Estado:** en curso. Las ramas de revisión usan la identidad única de La Voz Misionera; todavía no se autorizó su integración a `main` ni el cierre de E6/E7.

## Evidencia inicial

| Producto | Desktop | Móvil | Comprobación de esta pasada |
| --- | --- | --- | --- |
| Service | [1440 px](screenshots/m79e-v0/service-desktop.png) | [390 px](screenshots/m79e-v0/service-mobile.png) | Inicio con tokens V0 y marca; tests, lint y build |
| Worship | [1440 px](screenshots/m79e-v0/worship-desktop.png) | [390 px ES](screenshots/m79e-v0/worship-mobile.png), [390 px EN](screenshots/m79e-v0/worship-mobile-en.png) | 484 tests, lint, i18n y build; sin overflow a 390 px |
| Presenter | [Windows desktop](screenshots/m79e-v0/presenter-desktop.png) | No aplica al programa de cabina | Cabecera real sin DevTools ni menú duplicado; cierre del proceso; build frontend y tests del contrato |
| Web Pública | [1440 px](screenshots/m79e-v0/web-desktop.png) | [390 px](screenshots/m79e-v0/web-mobile.png) | 4 tests, 3 E2E, build; sin overflow |

La Web usa el mismo recurso local `hero-comunidad.webp` en ambos anchos. Se comprobó que la imagen carga y tiene 1672 px de ancho intrínseco tanto a 1440 como a 390 px. El recorte distinto responde a `background-size: cover`, no a una imagen ni un hero alternativo. El build público normal muestra una pantalla de preparación mientras no haya contenido publicado por Service; las rutas de demostración solo aparecen en `build:preview` o desarrollo.

## Lo que falta antes del gate

- Revisar las pantallas interiores de Service y Worship, además de sus estados loading, vacío, error y éxito.
- Comprobar Presenter con un servicio importado y observar slides/output con el nuevo tema, sin alterar el contenido proyectado.
- Revisar foco, contraste, movimiento reducido y anchos intermedios (768/1024) en los cuatro productos.
- Repetir una sola vez la demo integral desde las ramas actualizadas y revisar los diffs y CI de los PR borrador.

El verificador `scripts/verify-design-language.mjs` comprueba los valores de marca compartidos en los cuatro repositorios. M7.9F mapeará después estos tokens a los temas claro y oscuro; no se implementa un segundo diseño en este gate.
