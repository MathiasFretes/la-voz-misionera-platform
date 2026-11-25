# Gate reproducible de Worship Expo conectado

El verificador musical nativo usa ahora un clÃºster Docker desechable, con la API de Service y todas las migraciones de `suite-api/schema`, incluida 012. No reutiliza la base histÃ³rica de QA ni acepta un endpoint productivo como sustituto.

## EjecuciÃ³n

Con Node de `.node-version`, dependencias instaladas, el cliente canÃ³nico limpio en la carpeta hermana `LVM Worship` y el alias SSH `hostinger-vps` autorizado para Docker:

```sh
npm run test:native-gate-context
npm run test:native-connected:isolated
```

El lanzador archiva el `suite-api` comprometido en HEAD y registra SHA/Ã¡rbol de Service y Worship, Ã¡rbol especÃ­fico de API e imagen Docker. Los cambios sin comprometer en `suite-api` impiden el arranque. El cliente debe estar limpio y coincidir con la procedencia registrada.

Cada ejecuciÃ³n crea su propio proyecto `lvm-native-<identificador>`, PostgreSQL tmpfs, secretos nuevos y red Docker interna. No publica puertos en el host: el tÃºnel SSH alcanza la IP privada del contenedor verificada mediante Docker inspect. La autenticaciÃ³n nativa se habilita Ãºnicamente en esa API de QA. El proceso conserva el tÃºnel mientras vive el gate y lo cierra al terminar.

El manifiesto no basta por sÃ­ solo: antes de cualquier fixture, se comprueban el proyecto y red de los contenedores, almacenamiento efÃ­mero, ausencia de montajes y puertos productivos, imagen y etiquetas de procedencia, modo nativo de QA y registro de migraciÃ³n 012. Un manifiesto antiguo deja de ser utilizable cuando sus contenedores fueron eliminados. Los diagnÃ³sticos de fallos omiten credenciales.

Los resultados se guardan en `test-results/native-gate/<runId>/`. El lanzador elimina exclusivamente su proyecto, secretos temporales y archivo de transporte local, incluso cuando falla la prueba. No ejecuta compose en el proyecto productivo, no modifica Caddy ni cambia la bandera nativa desplegada.

## Resultado del 25 de noviembre de 2026

[Evidencia JSON](qa/native-connected-2026-11-25.json): cliente `71850c7f5e0037c928202a503d511e53a70d57f4` y servidor `a622fd0171eb469b2a42ca8bd3820cbd1a8e58a3`, con 012 y una imagen nueva etiquetada con su procedencia.

Pasaron las ocho comprobaciones reales del verificador: sesiones por dispositivo; catÃ¡logo y diario duradero offline; pÃ©rdida de respuesta y reenvÃ­o UUID; conflicto 409 entre sesiones; aplicaciÃ³n en Service conservando elementos manuales; aislamiento de cuenta/iglesia; revocaciÃ³n; y ausencia de credenciales en el diario musical. Los conteos de fixtures quedaron en cero y el proyecto se eliminÃ³.

Las 20 pruebas de protecciÃ³n del contexto, redacciÃ³n, polÃ­tica Android y procedencia del APK se incorporan a CI. No requieren SSH ni un VPS.

## LÃ­mite de esta evidencia

Se ejecutan los adaptadores reales de Expo en Node, con almacenamiento seguro inyectado en memoria y diario musical en disco. Esto no certifica SecureStore/Keystore en Android ni TLS o navegaciÃ³n de una app instalada. Este gate no cierra M9/W2 ni autoriza activar autenticaciÃ³n nativa en producciÃ³n.

## CompilaciÃ³n Android aislada

```sh
npm run build:native-android:isolated
```

Este modo crea una CA efÃ­mera y un servidor TLS propios del ensayo, sin abrir puertos pÃºblicos. Antes de compilar se prueba una conexiÃ³n vÃ¡lida y se exige el rechazo por CA no confiable y por nombre incorrecto. El overlay de Android permite esa CA solamente para `lvm-qa.invalid`; conserva verificaciÃ³n TLS y desactiva trÃ¡fico claro incluso en el manifiesto debug. No instala certificados en el telÃ©fono. Al finalizar restaura y compara los archivos CNG originales, incluidos los recursos de copia de seguridad de SecureStore.

El APK de QA usa `com.lavozmisionera.qa`, firma debug, JavaScript incluido y no necesita Metro. El manifiesto registra SHA del cliente y API, imagen, CA y bytes del APK. Es una compilaciÃ³n de prueba, no un paquete de distribuciÃ³n. El APK no se puede usar con el siguiente ensayo: su certificado pertenece al entorno eliminado y debe volver a compilarse para el entorno nuevo.

## SesiÃ³n fÃ­sica interactiva

En PowerShell, seleccionar expresamente el telÃ©fono autorizado antes de iniciar:

```powershell
$env:LVM_ADB = 'C:/Desarrollo/.toolcache/android-platform-tools/adb.exe'
$env:LVM_NATIVE_QA_SERIAL = '<serial observado con adb devices -l>'
npm run test:native-android:isolated
```

Sin serial o sin telÃ©fono conectado el lanzador falla antes de crear el clÃºster. Este modo mantiene vivos el entorno y TLS mientras se utiliza el protocolo JSON de `native-android-gate.mjs`. Instala Ãºnicamente el paquete QA, comprueba el hash de los bytes instalados y aÃ±ade un reverse exclusivo de ese serial. Rechaza sobrescribir otro reverse existente. La desconexiÃ³n simulada retira Ãºnicamente ese transporte de QA: no modifica Wi-Fi, datos mÃ³viles ni contenedores histÃ³ricos. La limpieza del servidor continÃºa incluso si se pierde el telÃ©fono; el informe registra si pudo confirmar la retirada del transporte.

Los comandos interactivos incluyen `open`, `dump`, `click`, `login`, `snapshot`, `offline`, `online`, `otherWrite`, `apply`, `membership`, `observe` y `finish`. Por ejemplo, una lÃ­nea `{"action":"open"}` abre el culto de los fixtures y `{"action":"finish","passed":false}` termina la sesiÃ³n y limpia sus datos. Las credenciales se generan en memoria y no se imprimen. No se admite reanudar fixtures histÃ³ricos ni se utilizan credenciales institucionales.

Una observaciÃ³n o `finish` con `passed:true` no certifica el gate: el informe mantiene `complete:false` y requiere revisar evidencias. Deben demostrarse login, almacenamiento seguro real, ediciÃ³n y reinicio offline, reintento UUID, conflicto, aislamiento, revocaciÃ³n y aplicaciÃ³n en Service. La compilaciÃ³n y las pruebas Node no sustituyen ese recorrido fÃ­sico.
