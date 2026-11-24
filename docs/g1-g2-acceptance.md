# G1/G2 — aceptación aislada, 23 de noviembre de 2026

Código/API probado: `b2018221172efe6b762fa6950d38f82ef38e1a30`. G1 y G2 corregidos; B1–B5 no se modifican.
No se autoriza ni ejecuta merge o despliegue.

## Cambios

Solo `LVM_NATIVE_AUTH_ENABLED=1` en servidor habilita rutas y tokens nativos.
Sin flag, con `0` u otro valor, no se aceptan rutas nativas ni Bearer emitidos
anteriormente. La cookie web permanece funcional. Expo no habilita el servidor.
El preparador nativo define el opt-in exclusivamente para su API de QA.

El archivo original `suite-api/test/integration.mjs` prepara canciones/borradores
mediante RPC y comprueba denegación de escrituras directas, incluso para editores.
Rechaza destinos ajenos al runner aislado. El manual ya no recomienda ejecutarlo
con provision-owner sobre la base productiva.

## Evidencia ejecutada

`sh suite-api/test/run-isolated.sh` pasó desde un archivo git del SHA citado:

- integration.mjs oficial: PASS con flag ausente, con `0` y con `1`.
- church-identity.mjs original: PASS.
- native-mode.integration.mjs: PASS. Alta/login nativo al habilitar; token previo
  rechazado en lectura/escritura privada y sesión al apagar; permisos y revocación
  por logout/cambio de contraseña. Sesiones web válidas en los tres modos.
- 15 tests API, 57 tests Service, lint/formato/build aprobados localmente.

El runner usa un proyecto Compose aleatorio, PostgreSQL tmpfs, secretos nuevos y
red interna sin puertos publicados ni montajes de producción. Aplica migraciones
up, omite down y retira contenedores/red/secretos en EXIT, también ante fallos.
El mismo comando quedó incorporado a church-planning en GitHub Actions.

Un primer archivo exportado en Windows contenía CRLF y no llegó a arrancar las
pruebas. `.gitattributes` fija LF para el runner; la repetición completa anterior
pasó. No se declara aprobada esa ejecución inicial.

[Resultado estructurado](evidence/g1-g2-20261123.json). El log completo permanece
en test-results/g1-g2-isolated.log; el JSON registra su SHA-256. Los resultados de
CI se enlazan en los PR una vez finalizados, sin atribuir este resultado local a
un workflow anterior. Android físico y activación productiva siguen pendientes.
