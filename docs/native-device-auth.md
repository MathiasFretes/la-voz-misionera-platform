# Sesión nativa del VPS — preflight, sin publicar

La app Expo conserva por ahora su cliente y autenticación anteriores. Esta entrega prepara y comprueba la frontera de sesión del dispositivo con los mismos usuarios de PostgreSQL, sin modificar ese cliente ni publicar la API nueva. No se afirma una migración nativa terminada.

## API

`/api/native/auth/{signup,login,session,logout,password}` requiere `X-LVM-Client: native`, ausencia de Origin/Sec-Fetch-Site y ausencia de cookies. Login/signup emiten un token opaco `n_…` con siete días de vigencia; solo su hash se guarda en `private.auth_sessions`. No emiten Set-Cookie. Es el mismo sistema de cuentas y revocación que usa la web, sin otra tabla de usuarios ni JWT de PostgREST en el cliente.

El token de dispositivo se acepta por Authorization únicamente con el encabezado nativo y sin cookies/origen de navegador. Un token web no se convierte en bearer y el token nativo no se acepta como cookie. Los tokens no eluden los permisos de PostgreSQL ni la comprobación `X-LVM-Account` de planificación. La web conserva su cookie HttpOnly y el control Origin de escrituras. No se habilita CORS.

## Transporte Expo preparado

Worship `apps/mobile/src/lib/deviceTransport.ts` es una frontera sin imports de React Native, con almacenamiento cifrado inyectado. Solo acepta HTTPS `/api`, restringe credenciales al origen configurado, omite cookies, rechaza redirecciones y usa rutas nativas de auth. Conserva una sesión no expirada durante fallos de red y la retira ante expiración/rechazo. Una generación evita que el login atrasado resucite la cuenta después de logout; las escrituras se serializan. No debe inyectarse AsyncStorage para credenciales.

## Evidencia

`node --experimental-strip-types scripts/verify-native-session.mjs` pasó contra la base aislada `lvm_planning_qa_20261121` y API interna mediante túnel SSH. El script fija ese destino y no permite ejecutarse sobre producción: alta nativa, token opaco sin cookie, restauración, lectura privada de datos, login web sobre la misma cuenta, protección CSRF web, rechazo de ruta nativa desde origen de navegador, rechazo de token nativo usado como cookie y revocación inmediata por cambio de contraseña web. Los fixtures propios se limpian al terminar. La sustitución de URL hacia loopback ocurre solamente en el fetch de prueba; no elimina la restricción de origen del transporte de aplicación.

Los tests de frontera nativa y de API se incluyen en `npm run test:suite-api`. Los tests del transporte están en Worship `apps/mobile/src/lib/__tests__/deviceTransport.test.ts`; el typecheck móvil pasó. El almacenamiento del preflight es una implementación de memoria, no prueba del Keystore de Android.

## Trabajo requerido antes de activar

Integrar almacenamiento seguro del sistema, el adaptador de cliente y la recuperación de sesión offline en el layout; deshabilitar los controles OAuth que la API no admite y comprobar login/logout/cambio de cuenta. Documentar `EXPO_PUBLIC_LVM_API_URL` junto con su uso efectivo. Después ejecutar exports Android/iOS y un recorrido nativo real, con repertorios y permisos. Solo entonces publicar coordinadamente la API y activar el build nativo. No mezclar ni importar sesiones antiguas de Supabase, y no guardar contraseñas en el dispositivo.
