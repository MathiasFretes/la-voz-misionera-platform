# Sesión nativa del VPS — preflight, sin publicar

La app Expo conserva por defecto su autenticación anterior. Esta entrega prepara y comprueba la frontera de sesión del dispositivo con los mismos usuarios de PostgreSQL; el adaptador y SecureStore ya se integraron detrás de la variable optativa `EXPO_PUBLIC_LVM_API_URL`, sin publicar esta API ni distribuir un build activado. No se afirma una migración nativa terminada.

## API

`/api/native/auth/{signup,login,session,logout,password}` requiere `X-LVM-Client: native`, ausencia de Origin/Sec-Fetch-Site y ausencia de cookies. Login/signup emiten un token opaco `n_…` con siete días de vigencia; solo su hash se guarda en `private.auth_sessions`. No emiten Set-Cookie. Es el mismo sistema de cuentas y revocación que usa la web, sin otra tabla de usuarios ni JWT de PostgREST en el cliente.

El token de dispositivo se acepta por Authorization únicamente con el encabezado nativo y sin cookies/origen de navegador. Un token web no se convierte en bearer y el token nativo no se acepta como cookie. Los tokens no eluden los permisos de PostgreSQL ni la comprobación `X-LVM-Account` de planificación. La web conserva su cookie HttpOnly y el control Origin de escrituras. No se habilita CORS.

## Transporte Expo preparado

Worship `apps/mobile/src/lib/deviceTransport.ts` es una frontera sin imports de React Native, con almacenamiento cifrado inyectado. Solo acepta HTTPS `/api`, restringe credenciales al origen configurado, omite cookies, rechaza redirecciones y usa rutas nativas de auth. Conserva una sesión no expirada durante fallos de red y la retira ante expiración/rechazo. Una generación evita que el login atrasado resucite la cuenta después de logout; las escrituras se serializan. No debe inyectarse AsyncStorage para credenciales.

## Evidencia

`node --experimental-strip-types scripts/verify-native-session.mjs` pasó contra la base aislada `lvm_planning_qa_20261121` y API interna mediante túnel SSH. El script fija ese destino y no permite ejecutarse sobre producción: alta nativa, token opaco sin cookie, restauración, lectura privada de datos, login web sobre la misma cuenta, protección CSRF web, rechazo de ruta nativa desde origen de navegador, rechazo de token nativo usado como cookie y revocación inmediata por cambio de contraseña web. Los fixtures propios se limpian al terminar. La sustitución de URL hacia loopback ocurre solamente en el fetch de prueba; no elimina la restricción de origen del transporte de aplicación.

Los tests de frontera nativa y de API se incluyen en `npm run test:suite-api` (14 pruebas aprobadas). Los tests del transporte están en Worship `apps/mobile/src/lib/__tests__/deviceTransport.test.ts` (5 pruebas); el typecheck, la suite móvil completa de 925 pruebas y los exports Metro Android/iOS pasaron. El transporte no está activado en las pantallas, por lo que esos exports prueban compatibilidad del árbol, no un recorrido de login nativo. El almacenamiento del preflight es una implementación de memoria, no prueba del Keystore de Android.

La planificación web volvió a pasar sus ocho escenarios de interfaz con la nueva API aislada: cookies, diario local, dos pestañas, reconexión, conflicto, aislamiento y revocación. La API productiva no se reemplazó. La preflight nativa también comprueba logout sin Set-Cookie, revocación del token anterior y que un token inválido no permite saltar el control Origin de una escritura.

## Trabajo requerido antes de activar

SecureStore, el adaptador de cliente y la recuperación offline ya están conectados en el layout cuando se define `EXPO_PUBLIC_LVM_API_URL`, documentada junto con su uso. Se ocultan los controles OAuth/recuperación por correo que esta API no admite y las solicitudes de exportación usan el transporte VPS para impedir que el token llegue al dominio anterior. Los endpoints de exportación siguen pendientes; la implementación optativa del editor musical conectado se describe más abajo y todavía requiere sus gates. Se comprobó mediante pruebas que cambiar la contraseña no descarta la nueva sesión después de revocar las anteriores.

Antes de publicar: instalar un build nativo nuevo con SecureStore y ejecutar login/logout/cambio de cuenta, recuperación offline, repertorios y permisos contra esta API aislada. Los exports Android/iOS con modo VPS comprobaron resolución/compilación, sin probar Keystore ni ejecución de pantallas. Solo después publicar coordinadamente la API y activar un build nativo. No mezclar ni importar sesiones antiguas de Supabase ni guardar contraseñas en el dispositivo.

## Evidencia Android de compilación

Worship `7bd5330b9` completó el 21 de noviembre `:app:assembleDebug` para `arm64-v8a` con JDK 17/SDK 36: `BUILD SUCCESSFUL` (545 tareas, 11 min 2 s). El APK nuevo tiene 118.887.117 bytes y SHA-256 `363D5BFD34E7D7DAE490AF20CEF2B2DF47BC18DABA0F7A5A05491FDD451E5C69`. Se verificaron las clases DEX de SecureStore, su registro de autolinking y las exclusiones de respaldo/transferencia de sus preferencias en los XML empaquetados.

Es un build debug dependiente de Metro, sin bundle JavaScript incrustado; no es una distribución autónoma ni evidencia de login o Keystore en ejecución. El SDK local no incluye emulador y quedó aproximadamente 1,2 GB libre después de compilar; no se descargó una imagen ni se retomó el teléfono excluido por el usuario. El gate de instalación y recorrido autenticado continúa abierto. Más detalle en Worship `apps/web/public/wiki/Native-VPS-Session.md`.

La comprobación móvil posterior a ese build, también sobre `7bd5330b9`, terminó con 930 pruebas aprobadas en 85 archivos y `tsc --noEmit` aprobado. Ese resultado actualiza el conteo histórico del preflight inicial; no convierte las pruebas con almacenamiento inyectado en una prueba del Keystore.

## Aislamiento de eventos de cuenta

Worship `b1e8fa353` amplió el control de generaciones a la decodificación JSON y a las notificaciones de sesión del adaptador. Una respuesta inicial, validación en primer plano o login superado no puede notificar la identidad anterior después de logout/reemplazo de cuenta. Las mutaciones invalidan consultas al comenzar y al completarse, incluso si la consulta empezó durante un login pendiente; el transporte impide que esa consulta vacía borre la credencial recién guardada. La persistencia cifrada también se vuelve a comprobar después de su escritura asíncrona.

Las regresiones reprodujeron fallos antes de las correcciones. Sobre esa revisión pasaron 937 pruebas móviles en 85 archivos, el chequeo de tipos y los exports Metro Android/iOS con el modo VPS seleccionado. Es código TypeScript posterior al APK debug anterior; no se presenta como una instalación o validación de Keystore, ni se publicó la API nativa.

## Editor musical conectado, pendiente de validación instalada

Worship `5cd6845fb` añade la ruta conectada de Expo y un repositorio compartido en `packages/core/src/setlists/worshipExchange.ts`. El enlace de Service `/setlist?churchId=…&serviceId=…` se reconoce como preparación conectada, no como lista de slugs. La cuenta viene de la sesión, y el editor conectado solo se monta con el modo VPS habilitado. La entrada anterior de intercambio por archivo se conserva.

El diario usa cuenta/iglesia/culto/rama, persiste UUID y revisiones antes de enviar, conserva las ediciones posteriores a un envío y retiene 409 para resolución explícita. La pantalla incluye biblioteca, orden, duplicación y tono por aparición, envío/reintento y exportación por archivo. Recupera una propuesta existente usando el conversor musical compartido y evita comenzar una sustitución vacía. La API sigue validando cuenta y permisos; la copia local no concede acceso remoto.

Pasaron 950 pruebas móviles en 87 archivos, 546 pruebas web, chequeo de tipos, paridad de idiomas y exports Metro Android/iOS. El build web pasó consultando el catálogo público PostgreSQL del VPS. Las trece pruebas específicas nuevas cubren diario y rutas, no interacción nativa real ni API musical instalada. Faltan selector de iglesia/culto, recuperación entre ramas, comparación visual de conflictos, recorrido con API aislada y dispositivo/emulador. No se activó ni distribuyó el cliente y no se publicó la API nativa. La evidencia detallada está en Worship `apps/web/public/wiki/Native-Connected-Service.md`.

## Actualización del gate: 23 de noviembre de 2026

Esta sección actualiza los estados históricos anteriores. Cliente exacto:
`5cd6845fb77e8e8643fe4c0a02705c8143fb27b3`. Servidor exacto:
`1949aac195a78c62ee7df017b45dec9f45ac959f`; árbol de API
`fe764c27c362129183bf6baffdd0eac563cbdfe4`.

`scripts/verify-native-connected.mjs` ejecutó el cliente nativo compartido contra
PostgreSQL/API reales en la base aislada `lvm_planning_qa_20261121`. El informe
local `test-results/native-gate/native-api-report.json`, ejecución
`6aaa1e19-26b8-48e1-858a-3a89b9d75413`, acredita ocho comprobaciones:

- Login y sesiones independientes, con identidad compartida con la web.
- Orden, duplicación, tonos y recuperación del diario offline sin escritura remota.
- Acuse perdido después del commit y reenvío del mismo UUID sin duplicación.
- HTTP 409 real entre sesiones, conservación local y resolución explícita.
- Aplicación en Service con igualdad frente a SQL y conservación de elementos manuales.
- Aislamiento por cuenta/iglesia y rechazo de cuenta inconsistente.
- Revocación, membresía suspendida, token falso/expirado y encabezado sin credencial.
- Ausencia de credenciales en el diario musical.

Resultado SQL final de esa ejecución: revisión musical 3, revisión de Service 2,
tres apariciones musicales y dos elementos manuales. El artefacto canónico tiene
SHA-256 `7b5954ab6bc1017509b99a617f9bbcafde744bf4fb58988ef824ed8386a0707c`.
Los fixtures de esa ejecución se limpiaron. El almacenamiento de credenciales
inyectado en esta prueba es de memoria: no acredita SecureStore ni Keystore.

También se generó e instaló en el Samsung A12 un APK de QA posterior al build
histórico `7bd5330b9`: `com.lavozmisionera.qa`, JavaScript incrustado y sin Metro,
123.582.898 bytes, SHA-256
`ea89d8601ef571a404c2e36ab0c3af2e67b189209721b9ac4b4a6dec83a41d4e`.
El manifiesto local `native-gate-20261122/android-build-manifest.json` en el
directorio temporal registra el SHA del cliente, el overlay de QA y la restauración
de los archivos originales. Es un build debug de pruebas, no una distribución final.

El canal privado usa HTTPS con validación normal del certificado, DNS de QA hacia
loopback, ADB reverse y túnel SSH. El proxy del VPS solo escucha en
`127.0.0.1:8443`. Sus registros contienen login nativo 200, sesión 200 y lectura
musical por iglesia 200 desde la instalación. Esto prueba el recorrido de esas
peticiones, no el gate completo de interfaz o almacenamiento seguro.

El 23 de noviembre ADB no detecta el teléfono. Siguen pendientes la inspección
de SecureStore/AsyncStorage, recuperación instalada tras cierre y sin conexión,
edición/reintento/conflicto desde la UI, cambio de cuenta/iglesia y logout/revocación
en el dispositivo. La ejecución física interrumpida conserva exclusivamente sus
fixtures de QA (tres usuarios, dos iglesias y dos canciones); no se confunde con
la ejecución anterior ya limpia. Deben limpiarse por sus identificadores propios
al finalizar. El proceso interactivo anterior terminó y sus credenciales solo
existían en memoria; no se guardaron en este documento.

Se comprobó la recuperación del controlador mediante
`node scripts/native-android-gate.mjs ad686733-8776-4c62-8861-c7e503a331a1`:
validó las tres cuentas, los dos cultos y las dos canciones del run existente,
recuperó acceso con credenciales efímeras nuevas exclusivamente de QA y mantuvo
las sesiones existentes. La propuesta sigue vacía, con cero filas de historial
y revisión de Service 1. Esta recuperación administrativa del fixture no es una
prueba de cambio de contraseña ni de restauración de sesión en Android.

La API nativa sigue sin publicarse. Ningún resultado anterior autoriza cerrar el
gate, ampliar funcionalidades o activar el cliente productivo antes de verificar
los escenarios pendientes.
