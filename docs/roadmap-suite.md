# Roadmap de La Voz Misionera

**Actualizado:** 2026-11-21 · **Alcance:** LVM Service, LVM Worship, LVM Presenter, LVM Web Pública y LVM Mobile.

## Despliegue del 20 de noviembre

Por instrucción del usuario, el VPS compartido usa Docker y una base PostgreSQL nueva, sin importar datos de Supabase. La raíz de `srv2137598.hstgr.cloud` reutiliza las 18 pantallas públicas de V0, `/app` abre Worship y `/service/` aloja Service. **Service es el panel administrativo de la suite**: gestiona cuentas/roles y recibe las solicitudes de los formularios públicos. La API compartida está en `suite-api/`; Worship consume esa API y su anterior ruta `/admin` redirige a Service. La fuente V0 original quedó intacta.

HTTPS, RLS, aislamiento de canciones/repertorios, activación de propietario, cookies HttpOnly, restauración de backups y el flujo formulario público → bandeja Service se comprobaron contra el VPS. Esto no cierra M9/W2/W3: faltan adopción integral de capacidades por iglesia, sincronización completa/offline de repertorios y migración de clientes nativos; la planificación Service 0.1 ya persiste por iglesia en PostgreSQL con diario local y conserva sus handoffs existentes. La edición editorial completa, email/OAuth y pagos tampoco se dan por terminados. Los gates que siguen conservan su alcance.

Este documento es el índice canónico del avance de la suite. Los documentos de cada milestone conservan la evidencia técnica y los contratos versionados; este archivo fija el orden de producto y evita que los repositorios avancen con prioridades contradictorias.

## Revisión integral y prioridad actual

La [auditoría del 20 de noviembre](auditoria-suite-2026-11-20.md) contrasta los cinco repositorios con el VPS. Por indicación del usuario, la prioridad inmediata es **Web Pública + Service como administración central**. No se desplazan personas, contenido editorial ni permisos generales a Worship.

El CMS conectado incorpora eventos, prédicas, sedes, pastores, ministerios y horarios. Se guardan borradores separados de la versión pública, se publica o retira explícitamente y cada escritura comprueba la revisión esperada. La API conserva un historial privado de revisiones. Esto es una primera vertical de M12, no su cierre: faltan las demás colecciones, edición de otras páginas, medios y un flujo editorial completo. La web lee sin cookies y filtra contenido publicado; incluso en registros publicados, las columnas de borrador no tienen permiso de lectura pública.

La conexión editorial también está desplegada: Inicio y transmisión usan `contenido/home`, Nosotros usa `contenido/nosotros` y el devocional usa `contenido/general`. Service edita registros únicos, conserva borradores privados y publica con revisión esperada. Inicio refleja la misión y el devocional publicados. La transmisión valida y abre su enlace y permite desactivarla; el devocional ofrece impresión y compartir reales. El recorrido se verificó en el VPS a 1440/390 px, incluyendo carga fallida y reintento, y se corrigieron controles móviles recortados y el acceso flotante que tapaba contenido. Se conserva el resto de M12 pendiente.

La trazabilidad del VPS está documentada con commits locales y `deployment.json`. Esto resuelve la incertidumbre sobre el código inspeccionado en el servidor, pero no equivale a integrar las ramas en GitHub/main ni a automatizar CI/CD. No se asigna un porcentaje global sin un inventario ponderado y criterios de aceptación aprobados.

M7 y M8 se conservan cerrados **dentro del alcance histórico documentado**. Sus gates locales/CI no prueban que toda la suite esté conectada en producción. La API anterior de planificación sigue privada; Service usa ahora las rutas autenticadas por iglesia de `suite-api`, conservando el modo local anterior como opción explícita. Las afirmaciones de PR y CI en documentos históricos deben leerse con su fecha, no como una verificación remota actual.

## Estado actual

| Bloque                              | Estado                      | Evidencia y límite actual                                                                                                             |
| ----------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| M7 — Suite funcional e identidad V0 | Cerrado en su alcance local | Contratos 0.1 y handoffs offline; no equivale a toda la suite conectada.                                                              |
| M7.8A–E — LVM NDI                   | Gate histórico funcional    | No se repitieron pruebas físicas ni benchmarks en esta auditoría.                                                                     |
| M7.8F — distribución NDI            | Pendiente de release        | NSIS, VM limpia y firma; no bloquea el CMS.                                                                                           |
| M8 — Backend y datos                | Cerrado en alcance local/CI | Persistencia y concurrencia de planificación probadas en su entorno; backend anterior sigue privado.                                  |
| M9 — Identidad y capacidades        | En curso                    | Sesión, iglesias/membresías y permisos administrativos por organización desplegados; falta adopción integral en los clientes.         |
| M10 — Organización                  | Pendiente                   | Personas, equipos y permisos por iglesia/sede. Una tarjeta editorial de sede no implementa este dominio.                              |
| M11 / W2 — Ecosistema conectado     | Vertical Web verificada     | Edición offline, conflicto y resolución en HTTPS, incorporación y entrega por archivo a Presenter Windows; adopción nativa pendiente. |
| M12 — CMS                           | En curso                    | Seis colecciones y cuatro pantallas editoriales conectadas; faltan otras páginas/colecciones, medios y flujo editorial completo.      |
| M13 — API pública y Web 2           | Parcial                     | Web V0 publicada; faltan API pública versionada y migración funcional completa.                                                       |
| M14A.1 — Fundación Flutter          | Gate histórico cerrado      | Cuatro bases Android; no reemplazan Expo ni prueban API real.                                                                         |
| M14E — Presenter Remote Core        | Gate físico histórico       | No se repitió QA de dispositivo en esta revisión.                                                                                     |
| M14E.2/M14E.3/M14A.2                | Revisión pendiente          | HEAD locales Presenter `e3c8d4b` y Mobile `187b683`; estados remotos de PR/CI no revalidados aquí.                                    |

La [primera vertical de identidad por iglesia](identity-churches.md) agrega gestión global de iglesias y membresías, acceso limitado de responsables a `/service/organization`, aislamiento en PostgreSQL y revocación efectiva sobre sesiones existentes. El directorio de correos solo es visible para administración global. Las capacidades de planificación son un contrato para la siguiente integración; no convierten el planificador local ni los clientes nativos en clientes conectados. M9 permanece abierto.

La [planificación por iglesia](planning-church-integration.md) está desplegada. El [gate de ocho escenarios](planning-acceptance.md) pasó en preproducción y contra el VPS publicado, con dos pestañas, reinicio del navegador, desconexión, respuestas atrasadas, conflicto 409 y revocación. Esto no completa W2 ni la adopción de identidad en clientes nativos.

El [preflight de sesión nativa](native-device-auth.md) ya incluye transporte VPS, adaptación de sesión y SecureStore optativos en Expo, pruebas contra PostgreSQL aislado y un APK Android debug compilado con el módulo y sus reglas de respaldo verificados. Falta instalarlo y probar el recorrido autenticado/offline en ejecución; no se publicó la API nativa ni se activó una distribución. Este paso no cierra M9/W1 ni sustituye la planificación musical nativa conectada pendiente en W2.

Worship `5cd6845fb` incorpora además el editor Expo conectado por enlace de Service, con un diario duradero por cuenta/iglesia/culto/rama, cola idempotente, conflictos explícitos y recuperación de propuestas musicales existentes. Pasaron 950 pruebas móviles, los exports y el build web con catálogo del VPS. Falta verificar esta integración contra la API aislada e instalada, y completar selección de iglesia/culto, recuperación entre ramas y comparación visual; es avance de código en W2, no una publicación nativa ni el cierre del gate.

## Orden de ejecución

1. Completar y verificar la administración Web → Service: publicación, borradores, permisos y bandeja; mantener la apariencia V0.
2. Completar M9: adoptar las membresías y capacidades ya disponibles en los clientes restantes y la planificación remota; incorporar recuperación segura de cuenta.
3. Mantener y ampliar la planificación autenticada ya desplegada: diario transaccional, reconexión, resolución explícita y revisiones por iglesia.
4. Ejecutar W2 entre Service y Worship con reconexión y conflictos; migrar el cliente Expo sin duplicar usuarios.
5. Completar M10 y las demás colecciones/editoriales de M12; después ampliar la API pública de M13.
6. Retomar M14E.2/M14E.3 y gates de distribución con evidencia vigente. No reabrir NDI técnico ni sustituir Expo por la preview Flutter.

M7.8F se retoma solo con evidencia nueva de electron-builder/NSIS, una actualización relevante de esas herramientas o una VM limpia. No se reabre NDI técnico.

## LVM Worship: decisión de producto

LVM Worship ya es un producto propio y funcional. El siguiente paso no es otra reimplementación general, sino elegir clientes canónicos y conectar un flujo musical completo al backend de M8.

### Superficies canónicas

| Superficie                              | Rol decidido                                                     | Próximo tratamiento                                                                               |
| --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Worship Web (React)                     | Cliente principal de biblioteca, autoría y planificación musical | Evolucionar sobre la implementación existente.                                                    |
| Worship Mobile (Expo)                   | Cliente nativo canónico para músicos, repertorios y Worship Mode | Conservar offline; conectar por repositorios/adaptadores.                                         |
| Worship Studio (macOS)                  | Cliente especializado de escritorio                              | Mantener; cerrar QA nativo en macOS antes de distribuir.                                          |
| `LVM Mobile/apps/lvm_worship` (Flutter) | Preview contractual de la suite                                  | No duplicar aquí el producto Expo. Mantener lectura local hasta una decisión formal de migración. |

Esta decisión evita mantener dos aplicaciones móviles con el mismo dominio, dos editores y dos bibliotecas que diverjan.

## Próximos bloques de Worship

### W0 — Baseline y límites

- Documentar las funciones que ya son producto: biblioteca, búsqueda, editor, arreglos, repertorios, Worship Mode, exportación y operación offline.
- Congelar el contrato observable de Web/Expo/Studio con tests existentes.
- Clasificar la persistencia actual: datos musicales, sesión/identidad, contenido editorial y caché local.
- Mantener fuera de Worship el CMS, blog, devocionales editoriales y administración de personas.

**Gate:** una matriz única de capacidades por cliente y una lista de datos que migrarán sin pérdida.

### W1 — Frontera de datos e identidad

- Definir `WorshipRepository` y `SessionCapabilities` como límites de aplicación.
- Mantener adaptadores actuales durante la transición; ninguna pantalla consume directamente un backend nuevo.
- Adoptar `UserId`, `ChurchId`, `Membership` y capacidades de M9 cuando estén disponibles.
- Conservar las rutas y sesiones existentes hasta probar migración y recuperación.

**Gate:** Web y Expo funcionan con adaptadores intercambiables; no existe una segunda fuente de usuarios o roles.

### W2 — Primera vertical conectada

Flujo objetivo:

```text
LVM Service crea el culto
        ↓
Worship recibe WorshipContext 0.1
        ↓
equipo prepara canciones, tonos y orden
        ↓
Worship guarda el borrador y trabaja offline
        ↓
Worship publica WorshipPlan 0.1
        ↓
Service integra el bloque musical
        ↓
Presenter recibe Service 0.1
```

La vertical debe usar PostgreSQL/API para sincronización y una cola local para continuar sin red. Los contratos 0.1 no cambian en este bloque.

**Gate:** crear el contexto en Service, editarlo en Worship Web o Expo, perder red, continuar, reconectar, resolver la revisión esperada y completar el handoff hasta Presenter.

**Evidencia del 21 de noviembre:** la vertical Web está publicada con PostgreSQL/migración 011: Service crea el contexto, Worship prepara y conserva una operación tras interrupción/recarga, reconecta y Service revisa e incorpora sin reemplazar elementos manuales. Pasaron la recuperación desde otro navegador y el retorno a la iglesia autorizada, incluso con otra selección guardada; los enlaces a iglesias no disponibles no abren otro ámbito. Se actualizaron también las entradas HTML directas de Worship.

El JSON descargado mediante «Presentación → Descargar para Presenter» del HTTPS publicado se importó directamente en la compilación Windows de Presenter, sin conversión por consola; se guardó, se reinició sin Internet y se mostró su letra en `.previewOutput`. Después se completó la pérdida total de red durante edición vinculada, recarga offline, conflicto 409 concurrente real y resolución explícita desde Worship. La versión resuelta se incorporó en Service conservando la bienvenida y ambas apariciones musicales; ese archivo final también pasó importación, persistencia y reinicio offline en Presenter. Esto verifica la vertical W2 Web → escritorio por archivo; no demuestra sincronización automática del escritorio, adopción Expo, instalador firmado ni salida física. La evidencia y límites están en [worship-connected-exchange.md](worship-connected-exchange.md).

### W3 — Producto Worship

- Unificar biblioteca, búsqueda, arreglos y repertorios entre Web y Expo.
- Hacer explícitos los estados `loading`, `empty`, `offline`, `conflict` y `error`.
- Mejorar ensayo/Worship Mode con el mismo modelo musical, sin duplicar parser o transposición.
- Conservar ES/EN y validar paridad i18n.
- Completar accesibilidad, responsive y QA táctil con datos de prueba seguros.

**Gate:** flujo de preparación musical completo en Web y Android, sin errores técnicos visibles y con recuperación offline comprobada.

**Avance Web del 21 de noviembre:** ensayo descargable y recuperación offline publicados; prueba con service worker real, letras/acordes, lecturas, notas, canciones privadas y tonos repetidos. Se comprobó que no se almacenan respuestas API en caché y que cambiar de cuenta revoca el acceso local. Worship pasó 546 pruebas locales. Android/Expo todavía no comparten esta API ni completaron este gate; el avance Web no cierra W3.

### W4 — Studio y distribución

- Compilar y ejecutar Studio en macOS.
- Validar Keychain/Auth, bridge JS/Swift, importación y exportación PDF/JPG.
- Verificar firma, notarización, iconos y migración de preferencias `gc.*` → `lvm.*`.

**Gate:** build firmado en macOS y compatibilidad de datos con Web/Expo.

## Primer slice recomendado

El primer cambio de implementación debe ser pequeño y vertical:

1. Crear la matriz W0 y fijar Web/Expo como clientes canónicos.
2. Introducir `WorshipRepository` detrás del listado de repertorios, sin cambiar la UI.
3. Añadir un adaptador de API para leer un `WorshipContext 0.1` persistido por Service.
4. Mantener el adaptador local y probar modo offline.
5. Guardar y devolver `WorshipPlan 0.1` con control de revisión, sin modificar el contrato.

El slice musical no introduce un editor Flutter, CMS dentro de Worship, blog, identidad propia de Worship, reescritura de ChordPro ni cambios a M7.8F. La publicación autorizada de las aplicaciones web y el CMS de Service se gestionan en el bloque de despliegue y en la prioridad actual, fuera de ese slice musical.

## Gates transversales

- Los contratos `WorshipContext 0.1`, `WorshipPlan 0.1`, `Service 0.1` y `PublicContent 0.1` permanecen versionados.
- Ningún cliente requiere red para continuar un culto ya descargado.
- Los permisos se validan en API/repositorio además de la UI.
- No se migra ni elimina información sin un inventario, correspondencia de IDs y rollback.
- Cada milestone termina con tests, build y una prueba humana del flujo real.
