# M14E — Revisión de integración del 24 de noviembre de 2026

Esta revisión registra desarrollo, QA e integración autorizada del 24 de noviembre. La distribución y el despliegue requieren autorización independiente.

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

## Gate físico aprobado para el HONOR y la LAN ensayada

El 24 de noviembre se instaló Mobile `57288cf0f03a6a962e2bb4b8a11c856c0c7393bd` en un **HONOR ELP-NX9, Android 16 / SDK 36**, expresamente autorizado por el usuario en lugar del Samsung A12. Presenter utilizó el candidato anterior combinado con su main en un perfil QA aislado.

El [informe físico verificable](https://github.com/MathiasFretes/lvm-mobile/blob/503df831584e0770ba2f22ba30d3724c3b4439a7/docs/qa/remote-device-2026-11-24.md) conserva procedencia, hashes, capturas, aserciones y snapshots de Presenter. El [workflow de construcción](https://github.com/MathiasFretes/lvm-mobile/actions/runs/45385545262) hizo checkout del SHA exacto de Mobile; la receta y la evidencia permanecen en una rama QA separada, sin modificar el HEAD del PR #17.

El APK original de CI se refirmó localmente con el certificado debug coincidente con la instalación previa. Se verificó que las entradas de contenido del APK no cambiaron, se actualizó sin borrar datos y se comprobó el hash del archivo instalado en el teléfono.

| Archivo                   | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| APK original de CI        | `75d093d77b3381c5c2a327ea5138a91fe9ef95c5311efe13b34d77b76561920e` |
| APK refirmado e instalado | `44abd210864932dc7aaf728665fe043829a7fec675f00c0afc67eb35ce32ff69` |

Se archivaron ambos APK, manifiestos y checksums verificados en `C:\la-voz-misionera\artifacts\remote\2026-11-24\57288cf`, fuera de la retención de siete días del artefacto de Actions. Es un archivo local, no un respaldo externo ni una distribución pública.

Pasaron el escaneo QR con cámara real, selección de canción/escritura y diapositiva, anterior/siguiente, blackout, pérdida de conexión por reinicio del transporte, nuevo QR y recuperación manteniendo la salida en negro, restauración explícita y desconexión manual. Una petición QA sin sesión fue rechazada sin alterar el estado de Presenter. El WebSocket usó la LAN Wi-Fi; USB/ADB se utilizó para instalación y operación de controles, y el reverse USB inicial se retiró antes del nuevo emparejamiento.

La aprobación en el host se ejecutó mediante el gestor real desde el harness QA; esta prueba no certifica el clic manual del operador en la interfaz de escritorio. Tampoco certifica el Samsung A12, todas las redes, un instalador firmado ni una salida física NDI/proyector. La interrupción ensayada fue el reinicio del transporte, no el cambio físico de punto de acceso. La recuperación requiere nuevo QR y aprobación, no reconexión automática.

## Integración coordinada autorizada

El usuario autorizó integrar Presenter antes que Mobile mediante merge commits, comprobar CI entre ambas fusiones y publicar después esta actualización documental mediante PR con CI obligatorio. Se verificaron los HEAD exactos y la ausencia de conflictos antes de cada operación.

| Producto      | Candidato conservado como padre            | Merge en main                              | CI posterior                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presenter #13 | `107d18ed8eb792c8fea6329044dd850ba3385609` | `fb2ce69cd650839223fb41ee421fdb9afbebe691` | [Workflow completo 45389346082](https://github.com/MathiasFretes/lvm-presenter/actions/runs/45389346082), aprobado antes de fusionar Mobile.                                                                                      |
| Mobile #17    | `57288cf0f03a6a962e2bb4b8a11c856c0c7393bd` | `cfa37a539d7622e48c3acba02b0e885c7b089f0f` | [Análisis/pruebas 45390003004](https://github.com/MathiasFretes/lvm-mobile/actions/runs/45390003004) y [cuatro builds 45390003522](https://github.com/MathiasFretes/lvm-mobile/actions/runs/45390003522), cinco checks aprobados. |

El árbol integrado de Presenter coincide con el ensayado en QA: `372ccfd855c1918e7dec4afe617ccd1239a35443`. No hubo squash, rebase ni eliminación de ramas. No se modificó producción. Los PR #13 y #17 quedaron fusionados y cerrados; la auditoría Mobile #11 sigue pendiente. Esta integración no cierra M9/W2 de Expo ni los gates de distribución o proyección física.

## Otros pendientes

Mobile #11 es una auditoría documental y no aprueba ni sustituye el sello institucional. La variante histórica `m14a1-foundation` conserva diferencias de workflow y recursos Android; no debe fusionarse completa sin comparar los archivos. Ni esa auditoría ni M14E cierran M9/W2 de Worship Expo.
