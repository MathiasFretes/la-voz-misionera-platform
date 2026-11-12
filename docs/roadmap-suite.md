# Roadmap de La Voz Misionera

**Actualizado:** 2026-11-12 · **Alcance:** LVM Service, LVM Worship, LVM Presenter, LVM Web Pública y LVM Mobile.

Este documento es el índice canónico del avance de la suite. Los documentos de cada milestone conservan la evidencia técnica y los contratos versionados; este archivo fija el orden de producto y evita que los repositorios avancen con prioridades contradictorias.

## Estado actual

| Bloque                                    | Estado                 | Evidencia y límite actual                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M7 — Suite funcional e identidad V0       | ✅ Cerrado             | Flujo offline Service → Worship → Service → Presenter y Service → Web Pública; contratos 0.1 congelados; identidad navy/dorado/blanco integrada.                                                                                                                                                                                                                     |
| M7.8A–E — LVM NDI                         | ✅ Funcional           | Sender propio, video E2E, integración y UI completados.                                                                                                                                                                                                                                                                                                              |
| M7.8F — distribución NDI                  | 🟡 Pausado             | Funciona instalado; queda la limpieza de claves de registro NSIS, VM limpia y firma. No bloquea el producto.                                                                                                                                                                                                                                                         |
| M8 — Backend y datos                      | ✅ Cerrado             | PostgreSQL, API, migraciones, repositorios, concurrencia, backup/restore y empaquetado privado verificados en CI.                                                                                                                                                                                                                                                    |
| M14A.1 — Fundación Flutter                | ✅ Cerrado             | Cuatro apps Android y paquetes compartidos; todavía no reemplazan los clientes de producto existentes.                                                                                                                                                                                                                                                               |
| M14E — Presenter Remote Core              | ✅ Cerrado             | QR, aprobación local, WebSocket LAN, navegación, Biblia, blackout, restore, reconexión y seguridad probados físicamente.                                                                                                                                                                                                                                             |
| M14E.2 / M14E.3 / M14A.2                  | 🟡 En revisión         | Snapshot rico, orden real del culto y UX/identidad final están en los PR borrador [Presenter #13](https://github.com/MathiasFretes/lvm-presenter/pull/13) y [Mobile #17](https://github.com/MathiasFretes/lvm-mobile/pull/17), ambos mergeables y con CI verde. La auditoría visual [Mobile #11](https://github.com/MathiasFretes/lvm-mobile/pull/11) sigue abierta. |
| M9 — Identidad, acceso y capacidades      | ⏳ Siguiente fundación | Definir identidad central, sesión, iglesia, membresía y capacidades. No duplicar usuarios en Worship.                                                                                                                                                                                                                                                                |
| M10 — Iglesias, sedes, personas y equipos | 🔒 Después de M9       | Modelo organizacional y permisos por iglesia/sede.                                                                                                                                                                                                                                                                                                                   |
| M11 — Ecosistema conectado                | 🔒 Después de M9/M10   | Conectar los productos a la API real preservando contratos y operación offline. La primera vertical será Worship.                                                                                                                                                                                                                                                    |
| M12 — CMS                                 | 🔒 Posterior           | Service administra contenido; Web Pública consume contenido publicado.                                                                                                                                                                                                                                                                                               |
| M13 — API pública y Web Pública 2         | 🔒 Posterior           | Publicación externa, contratos públicos y migración final desde V0.                                                                                                                                                                                                                                                                                                  |

## Orden de ejecución

1. Resolver la revisión de M14E.2/M14E.3 sin ampliar el alcance del control remoto.
2. Cerrar la decisión de producto de LVM Worship descrita abajo.
3. Implementar M9A: contrato de identidad y capacidades de la suite.
4. Ejecutar la primera vertical conectada de M11 con Worship.
5. Completar M10 y ampliar el ecosistema a equipos, sedes y personas.
6. Abrir M12/M13 cuando identidad, permisos y datos estén estables.

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

### W3 — Producto Worship

- Unificar biblioteca, búsqueda, arreglos y repertorios entre Web y Expo.
- Hacer explícitos los estados `loading`, `empty`, `offline`, `conflict` y `error`.
- Mejorar ensayo/Worship Mode con el mismo modelo musical, sin duplicar parser o transposición.
- Conservar ES/EN y validar paridad i18n.
- Completar accesibilidad, responsive y QA táctil con datos de prueba seguros.

**Gate:** flujo de preparación musical completo en Web y Android, sin errores técnicos visibles y con recuperación offline comprobada.

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

No entran en este slice: un nuevo editor Flutter, CMS, blog, auth propia de Worship, reescritura masiva de ChordPro, publicación de Service/Worship ni cambios a M7.8F.

## Gates transversales

- Los contratos `WorshipContext 0.1`, `WorshipPlan 0.1`, `Service 0.1` y `PublicContent 0.1` permanecen versionados.
- Ningún cliente requiere red para continuar un culto ya descargado.
- Los permisos se validan en API/repositorio además de la UI.
- No se migra ni elimina información sin un inventario, correspondencia de IDs y rollback.
- Cada milestone termina con tests, build y una prueba humana del flujo real.
