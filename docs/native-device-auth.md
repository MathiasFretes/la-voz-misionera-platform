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

SecureStore, el adaptador de cliente y la recuperación offline ya están conectados en el layout cuando se define `EXPO_PUBLIC_LVM_API_URL`, documentada junto con su uso. Se ocultan los controles OAuth/recuperación por correo que esta API no admite y las solicitudes de exportación usan el transporte VPS para impedir que el token llegue al dominio anterior. Esto todavía no implementa los endpoints de exportación ni la planificación musical nativa conectada. Se comprobó mediante pruebas que cambiar la contraseña no descarta la nueva sesión después de revocar las anteriores.

Antes de publicar: instalar un build nativo nuevo con SecureStore y ejecutar login/logout/cambio de cuenta, recuperación offline, repertorios y permisos contra esta API aislada. Los exports Android/iOS con modo VPS comprobaron resolución/compilación, sin probar Keystore ni ejecución de pantallas. Solo después publicar coordinadamente la API y activar un build nativo. No mezclar ni importar sesiones antiguas de Supabase ni guardar contraseñas en el dispositivo.
