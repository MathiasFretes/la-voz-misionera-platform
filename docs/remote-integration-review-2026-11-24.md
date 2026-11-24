# M14E — Revisión de integración del 24 de noviembre de 2026

Esta revisión acredita desarrollo y QA; no autoriza merge, distribución ni despliegue.

## Candidatos y evidencia

| Producto      | SHA revisado                               | Resultado                                              |
| ------------- | ------------------------------------------ | ------------------------------------------------------ |
| Presenter #13 | `107d18ed8eb792c8fea6329044dd850ba3385609` | Unitarias, contratos, build y Electron real aprobados. |
| Mobile #17    | `57288cf0f03a6a962e2bb4b8a11c856c0c7393bd` | Análisis, pruebas y cuatro builds Android aprobados.   |

- [Presenter #13: alcance y revisión](https://github.com/MathiasFretes/lvm-presenter/pull/13).
- [Mobile #17: correcciones y revisión](https://github.com/MathiasFretes/lvm-mobile/pull/17).
- [CI de análisis y pruebas de Mobile](https://github.com/MathiasFretes/lvm-mobile/actions/runs/45381858514).
- [CI de las cuatro compilaciones Android](https://github.com/MathiasFretes/lvm-mobile/actions/runs/45381858530).

Los resultados de Presenter que siguen son ejecución local del desarrollador, no nuevos checks remotos ni evidencia de salida física. La evidencia local quedó en `C:\la-voz-misionera\.verification\remote-review-20261124` y sus conclusiones se registraron en ambos PR.

## Presenter

Se combinó el candidato con `main` `4b7436d5f64259c51bc0587327ea15a93a26f9d1` en un checkout aislado, sin commit de integración ni actualización remota. Árbol resultante: `372ccfd855c1918e7dec4afe617ccd1239a35443`.

- `npm run test:unit`: 188 aprobadas, 9 omitidas.
- `npm run test:lvm`: 8 aprobadas.
- `npm run build`: aprobado.
- `LVM_REMOTE_RICH_QA=1`, `scripts/lvm/presenter-remote-live-e2e.mjs`: aprobado con Electron real, perfil temporal y datos QA.

El E2E verificó proyecto con canción y escritura, snapshot enriquecido, `goToItem`, navegación, blackout, nuevo emparejamiento conservando el estado durante blackout, restauración explícita, cambios locales y autorización. Los primeros intentos fallaron por la entrada HTML posterior al build y una recarga de optimización de Vite; restaurar el HTML de desarrollo del checkout QA y completar la optimización permitió repetir el script sin cambiar el código candidato.

## Mobile Remote

Las ocho pruebas de Remote pasaron en el SHA indicado. Incluyen handshakes WebSocket reales demorados hasta después de `disconnect` o `dispose`, descarte de snapshot tras cierre de conexión, enlace de emparejamiento ya utilizado, navegación básica/Biblia, snapshot anterior y selección de elementos del culto.

La vista anterior sin `items` conserva la presentación activa y los controles `goTo`; no muestra «Sin culto cargado» cuando Presenter sí informa una presentación. El snapshot enriquecido mantiene `goToItem`. La prueba legacy inicial no desplazaba la lista hasta el control antes de pulsarlo; se corrigió y pasó en el SHA actual.

El cierre de WebSocket elimina token y snapshot locales. La recuperación sigue requiriendo un nuevo emparejamiento explícito; no se implementó reconexión automática.

## Gate físico pendiente

La prueba Samsung SM-A125M registrada anteriormente corresponde a Mobile `187b683`; no certifica `57288cf`. Los builds debug aprobados no demuestran instalación, QR/cámara, interacción táctil ni continuidad real bajo pérdida de red en ese dispositivo.

Antes de cerrar M14E.3, registrar:

1. SHA y procedencia verificable del APK instalado y versión exacta de Presenter.
2. Emparejamiento QR con aprobación, snapshot del culto y navegación por elemento/diapositiva.
3. Desconexión y nuevo emparejamiento, sin alterar la salida de Presenter durante blackout.
4. Restauración explícita, desconexión/logout y rechazo de controles sin sesión autorizada.
5. Resultado y fallos pendientes, sin reutilizar la evidencia física de otra versión.

Después del gate y la revisión final, una autorización de integración permitiría fusionar primero Presenter y después Mobile mediante el procedimiento acordado y verificar CI de los nuevos `main`. La distribución y el despliegue requieren autorización separada.

## Otros pendientes

Mobile #11 es una auditoría documental y no aprueba ni sustituye el sello institucional. La variante histórica `m14a1-foundation` conserva diferencias de workflow y recursos Android; no debe fusionarse completa sin comparar los archivos. Ni esa auditoría ni M14E cierran M9/W2 de Worship Expo.
