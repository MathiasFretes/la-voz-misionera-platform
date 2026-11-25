# Worship Expo: ensayo físico HONOR del 25 de noviembre de 2026

El recorrido funcional ensayado pasó en el HONOR ELP-NX9 con Android 16. Quedan observaciones de interfaz y revisión independiente de la evidencia. Este resultado no cierra por sí solo M9/W2, no autoriza fusionar PR y no modifica producción.

## Procedencia

- Service/API y herramientas: `1e8ea37093a723430067c0144ce05fe722ce9659`.
- Worship: `71850c7f5e0037c928202a503d511e53a70d57f4`.
- Sesión desechable: `cc23bfa7-a76b-44b0-b327-43e3001585b6`.
- Fixtures físicos: `78b0737e-b785-47aa-b805-0751379678f5`.
- APK nuevo: `f8e8b5be137ae7ff8cd4d569fa546f2ddc141d88ee4575cd310cac9b8dc4df84`, 128.071.601 bytes.
- Paquete independiente: `com.lavozmisionera.qa`, firma debug. Los bytes instalados se compararon con el APK generado.

Se ejecutó `npm run test:native-android:isolated` con el serial explícito autorizado. El lanzador reconstruyó el APK con una CA nueva y mantuvo su API, PostgreSQL tmpfs y proxy HTTPS activos durante el ensayo. Las ocho comprobaciones previas de API/PostgreSQL y las comprobaciones TLS del host también pasaron.

## Resultados observados

| Escenario                | Evidencia                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login nativo y HTTPS     | Login desde la app y apertura del culto QA; solicitudes del teléfono registradas por el proxy TLS.                                                                                          |
| Almacenamiento de sesión | SecureStore contiene cifrado AES con IV; no aparecen campos de sesión ni tokens nativos en AsyncStorage. El reinicio del proceso sin transporte conserva la sesión.                         |
| Preparación musical      | Selección de dos canciones, duplicación, cambio de orden y cambio C → G de Fidelidad. PostgreSQL conserva G y acordes transpuestos G/D.                                                     |
| Reinicio offline         | Se retiró solo el reverse de QA. Tras force-stop y reapertura, borrador de tres canciones y operación pendiente idénticos.                                                                  |
| Reintento                | UUID `e5582b7f-b7d7-40db-8ad4-d2b36b0253cb` aceptado una vez al reconectar; primera revisión e historial con una entrada.                                                                   |
| Conflicto                | Una sesión API independiente generó una revisión nueva. El teléfono recibió 409, conservó G y la operación pendiente; cancelar, actualizar y reenviar resolvió el conflicto explícitamente. |
| Aplicación en Service    | Tres ocurrencias musicales y dos elementos manuales conservados; validación del contrato y comparación con el merge canónico aprobadas.                                                     |
| Revocación de membresía  | PUT desde el teléfono devolvió 403; propuesta e historial permanecieron en revisión 3 y tres filas. El borrador local de cuatro entradas se conservó.                                       |
| Aislamiento              | Segunda cuenta ve su otro culto vacío y recibe 403 sobre la primera iglesia. La primera cuenta recupera su borrador pendiente al volver a entrar.                                           |
| Revocación de sesión     | Se revocaron únicamente las dos sesiones de la segunda cuenta QA. El teléfono recibió 401, retiró la credencial y mostró login.                                                             |
| Logout y limpieza        | Logout explícito deja cero entradas en SecureStore. El guion limpió fixtures; el lanzador eliminó contenedores, secretos y reverse, y restauró los overlays CNG.                            |

## Observaciones de interfaz

1. La pantalla de cuenta conserva texto en inglés con el idioma español seleccionado: Account, PROFILE, Your icon, Log out y Delete account. El diálogo de confirmación de logout sí aparece en español.
2. Un 403 durante la carga inicial de una iglesia se muestra como un error genérico de conexión/actualización. No apareció información de la iglesia anterior, pero el mensaje debería explicar el permiso insuficiente.
3. Las primeras interacciones del selector de tono y de un re-login necesitaron repetición. El teléfono cambió también a Ajustes de Android durante la prueba; no se estableció un crash de LVM. Después se verificaron el selector, G persistido y recuperación del borrador al reingresar. Estos intentos iniciales son inconclusos, no se presentan como una regresión reproducida.

## Evidencia y límites

El [informe estructurado](native-android-2026-11-25/report.json), las [solicitudes HTTPS](native-android-2026-11-25/phone-https-requests.json), el [estado SQL anterior a la limpieza](native-android-2026-11-25/server-final-before-cleanup.json) y los [checksums](native-android-2026-11-25/checksums.json) permiten contrastar el resultado. Los estados del diario antes y después del reinicio, el conflicto, la separación por cuenta y las inspecciones de almacenamiento están en la misma carpeta.

Capturas: [reinicio offline](native-android-2026-11-25/03-offline-restart.png), [conflicto](native-android-2026-11-25/04-real-conflict.png), [otra cuenta](native-android-2026-11-25/05-other-account-own-church.png), [sesión revocada](native-android-2026-11-25/06-revoked-session-login.png) y [borrador recuperado](native-android-2026-11-25/07-restored-original-account-draft.png).

El ensayo cubre un HONOR y transporte por USB/ADB reverse. No cambió Wi-Fi ni datos móviles. El segundo escritor fue otra sesión API, no otro teléfono. No se inyectó pérdida de ACK posterior al commit en el teléfono; ese escenario tiene evidencia separada en el gate headless. SecureStore cifrado y recuperación fueron comprobados, pero no se certifica respaldo físico de hardware del Keystore ni funcionamiento con el dispositivo bloqueado. Las pruebas negativas de CA/hostname se ejecutaron en el host; Android comprobó la conexión positiva con su CA limitada al dominio QA.

El guion conserva `complete:false` y exige revisión independiente: `finish` con `passed:true` solo registra la observación del operador. El APK de QA y los borradores sin credenciales quedan en su paquete separado; su servidor y CA temporal ya se eliminaron y la próxima sesión requiere reconstrucción. No hubo distribución, fusiones, migraciones productivas ni activación nativa en producción.
