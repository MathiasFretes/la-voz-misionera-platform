# Gate reproducible de Worship Expo conectado

El verificador musical nativo usa ahora un clúster Docker desechable, con la API de Service y todas las migraciones de `suite-api/schema`, incluida 012. No reutiliza la base histórica de QA ni acepta un endpoint productivo como sustituto.

## Ejecución

Con Node de `.node-version`, dependencias instaladas, el cliente canónico limpio en la carpeta hermana `LVM Worship` y el alias SSH `hostinger-vps` autorizado para Docker:

```sh
npm run test:native-gate-context
npm run test:native-connected:isolated
```

El lanzador archiva el `suite-api` comprometido en HEAD y registra SHA/árbol de Service y Worship, árbol específico de API e imagen Docker. Los cambios sin comprometer en `suite-api` impiden el arranque. El cliente debe estar limpio y coincidir con la procedencia registrada.

Cada ejecución crea su propio proyecto `lvm-native-<identificador>`, PostgreSQL tmpfs, secretos nuevos y red Docker interna. No publica puertos en el host: el túnel SSH alcanza la IP privada del contenedor verificada mediante Docker inspect. La autenticación nativa se habilita únicamente en esa API de QA. El proceso conserva el túnel mientras vive el gate y lo cierra al terminar.

El manifiesto no basta por sí solo: antes de cualquier fixture, se comprueban el proyecto y red de los contenedores, almacenamiento efímero, ausencia de montajes y puertos productivos, imagen y etiquetas de procedencia, modo nativo de QA y registro de migración 012. Un manifiesto antiguo deja de ser utilizable cuando sus contenedores fueron eliminados. Los diagnósticos de fallos omiten credenciales.

Los resultados se guardan en `test-results/native-gate/<runId>/`. El lanzador elimina exclusivamente su proyecto, secretos temporales y archivo de transporte local, incluso cuando falla la prueba. No ejecuta compose en el proyecto productivo, no modifica Caddy ni cambia la bandera nativa desplegada.

## Resultado del 25 de noviembre de 2026

[Evidencia JSON](qa/native-connected-2026-11-25.json): cliente `71850c7f5e0037c928202a503d511e53a70d57f4` y servidor `a622fd0171eb469b2a42ca8bd3820cbd1a8e58a3`, con 012 y una imagen nueva etiquetada con su procedencia.

Pasaron las ocho comprobaciones reales del verificador: sesiones por dispositivo; catálogo y diario duradero offline; pérdida de respuesta y reenvío UUID; conflicto 409 entre sesiones; aplicación en Service conservando elementos manuales; aislamiento de cuenta/iglesia; revocación; y ausencia de credenciales en el diario musical. Los conteos de fixtures quedaron en cero y el proyecto se eliminó.

Las 14 pruebas de protección del contexto y redacción de diagnósticos se incorporan a CI. No requieren SSH ni un VPS.

## Límite de esta evidencia

Se ejecutan los adaptadores reales de Expo en Node, con almacenamiento seguro inyectado en memoria y diario musical en disco. Esto no certifica SecureStore/Keystore en Android ni TLS o navegación de una app instalada. Los scripts históricos `native-android-gate.mjs` y `build-native-gate-android.mjs` todavía requieren conectar su procedencia y transporte al nuevo entorno antes de certificar un APK actual. Este gate no cierra M9/W2 ni autoriza activar autenticación nativa en producción.
