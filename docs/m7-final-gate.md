# M7.x — Gate técnico de la suite

Estado: **aprobado en ramas de revisión; integración a `main` pendiente**. Fecha: 2026-10-08. Este gate no publica software ni habilita M8 automáticamente en producción.

| Área | Evidencia | Resultado |
| --- | --- | --- |
| LVM Service | Editor local, contratos versionados, `npm run lint`, `npm run build`, `docs/m79d-suite-demo.md` | Aprobado para la demo |
| LVM Worship | Web de repertorios, i18n ES/EN, `i18n:check`, 484 tests, build de preview | Aprobado para el flujo offline de archivos |
| LVM Presenter | Importación Service, diapositiva y salida física; cabina ES regional, menú único; build Electron/frontend | Aprobado para la demo local |
| LVM Web Pública | PublicContent 0.1 importado, Inicio/Eventos/Prédicas/Sedes, 4 tests, build | Aprobado como preview |
| Suite | `npm run test:demo` posterior al pulido, red externa bloqueada; QA manual del usuario registrada en M7.9D | Aprobado funcionalmente |
| Lenguaje visual | `npm run test:design-language`, capturas desktop/390 px de cuatro productos, Service producción sin Contract Inspector | M7.9E 0.1 aprobado para las superficies de demo |

Las capturas y la reproducción se encuentran en [`m79d-suite-demo.md`](m79d-suite-demo.md) y [`m79e-visual-audit.md`](m79e-visual-audit.md). Los resultados se obtuvieron sobre ramas de revisión; no se infiere que `main` contenga esta integración. Worship Web conserva una dependencia de backend para repertorios de cuenta. Web Pública sigue siendo preview con datos de archivo/fixture. Presenter M7.8F mantiene separado su defecto de desinstalación NSIS; no bloquea la demo local ni se declara apto para release Windows.

## Base acordada para diseñar M8

- `WorshipContext 0.1`: contexto de culto que Service entrega a Worship.
- `WorshipPlan 0.1`: repertorio ordenado que Worship devuelve a Service.
- `Service 0.1`: orden completo validado que Presenter importa.
- `PublicContent 0.1`: preview de contenidos que Service entrega a Web Pública.

M8 puede diseñar PostgreSQL, API, repositorios, migraciones y persistencia sobre estos límites probados. Cualquier evolución del contrato requiere versión y migración explícitas. El gate no incorpora Auth, Supabase nuevo, publicación pública real ni transferencias en vivo entre productos.

## Integración pendiente

Cada repositorio conserva su rama `codex/m79e-visual-unification`. Antes de cerrar M7.x en `main`, integrar y revisar esas ramas según las reglas de cada repositorio, repetir CI en el destino y confirmar que las cuatro aplicaciones siguen apuntando a los contratos indicados. Worship exige que el usuario abra el PR; este documento no sustituye esa revisión.
