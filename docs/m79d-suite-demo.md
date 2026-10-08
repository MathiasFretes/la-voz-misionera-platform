# M7.9D — Demo integral LVM

## Escenario oficial

La fuente de los datos de esta demo es [`fixtures/m79d-demo.json`](../fixtures/m79d-demo.json). Iglesia: **La Voz Misionera**; sede: **Templo Central**; culto: **Culto Domingo 19:00**. El orden tiene Bienvenida, Adoración (Canción A, B y C), prédica **Viviendo por fe**, Ofrenda y Cierre. El contenido público usa la misma prédica y sede, más el evento **Encuentro Juvenil**. Los textos y dirección son de demostración; no representan contenido publicado por la iglesia.

| Producto        | Responsabilidad en la demo                           | Archivo de intercambio                             |
| --------------- | ---------------------------------------------------- | -------------------------------------------------- |
| LVM Service     | Crear el culto y consolidar el orden                 | WorshipContext 0.1; Service 0.1; PublicContent 0.1 |
| LVM Worship     | Preparar tres canciones y su orden                   | WorshipPlan 0.1                                    |
| LVM Presenter   | Importar y presentar el proyecto derivado de Service | `.project` generado por el adaptador               |
| LVM Web Pública | Revisar el contenido antes de mostrarlo localmente   | PublicContent 0.1                                  |

Los cuatro checkouts usados para esta demo son ramas de revisión. Presenter `main` no incluye todavía el trabajo de la rama baseline; M7.8F continúa pausado. Ningún paso requiere Supabase, API, PostgreSQL, NDI o conexión a Internet.

## Reproducción automatizada en Windows

Usar Node 22.23.0 y dependencias ya instaladas en los cuatro repositorios. Desde este checkout de Service:

```powershell
$env:WORSHIP_REPO = 'C:\la-voz-misionera\LVM Worship'
$env:PRESENTER_REPO = 'C:\la-voz-misionera\.worktrees\M79 Presenter Baseline'
$env:PUBLIC_WEB_REPO = 'C:\la-voz-misionera\LVM Web Publica'
npm run test:demo
```

El runner ejecuta secuencialmente `test:suite` y `test:public-preview`, captura las pantallas en `docs/screenshots/m79d/` y bloquea solicitudes HTTP no locales. Genera archivos temporales de contrato, verifica su contenido, los importa desde las interfaces, comprueba reapertura de Worship y Presenter y revisa las cuatro páginas públicas. Los perfiles de prueba se aíslan y se eliminan al terminar. Esta prueba verifica el flujo automatizado; no sustituye la revisión manual de operabilidad visual.

## Recorrido manual

Iniciar tres terminales, cada una desde su repositorio. En esta demo local se usa una URL de Supabase deliberadamente inactiva para comprobar los estados de error sin una cuenta QA; las canciones del culto se importan desde los tres archivos ChordPro del fixture.

```powershell
# LVM Service (este checkout)
$env:VITE_WORSHIP_URL='http://127.0.0.1:4174'
$env:VITE_WEB_PUBLICA_URL='http://127.0.0.1:4175'
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 4173 --strictPort

# LVM Worship (C:\la-voz-misionera\LVM Worship\apps\web)
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_ANON_KEY='demo-anon-key'
node ..\..\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 4174 --strictPort

# LVM Web Pública (C:\la-voz-misionera\LVM Web Publica)
node .\node_modules\vite\bin\vite.js --host 127.0.0.1 --port 4175 --strictPort
```

Para Presenter, usar dos terminales adicionales desde `C:\la-voz-misionera\.worktrees\M79 Presenter Baseline`, en la rama `codex/m79d-presenter-demo-qa`. La primera compila Electron y deja Vite activo; la segunda abre la aplicación con un perfil de demo separado. No establecer `LVM_OPEN_DEVTOOLS=1`.

```powershell
# Terminal de frontend; ejecutar antes una vez: npm run build:electron:dev
npm run build:frontend:dev

# Otra terminal, en el mismo checkout, cuando localhost:3000 responda
$env:NODE_ENV='development'
$env:FS_MOCK_STORE_PATH="$env:TEMP\lvm-m79d-presenter-settings"
$env:APPDATA="$env:TEMP\lvm-m79d-presenter-appdata"
New-Item -ItemType Directory -Force -Path $env:FS_MOCK_STORE_PATH,$env:APPDATA | Out-Null
& '.\node_modules\.bin\electron.cmd' .
```

Cerrar Presenter normalmente al terminar, detener Vite con `Ctrl+C` y comprobar que no quedan procesos de esta prueba. La revisión automática captura su ventana principal y la salida física, y comprueba que los procesos Electron del arnés terminan.

1. Abrir Service en `http://127.0.0.1:4173` con `VITE_WORSHIP_URL=http://127.0.0.1:4174` y `VITE_WEB_PUBLICA_URL=http://127.0.0.1:4175`. Abrir Worship en `4174`, Web Pública en `4175` y Presenter desde el checkout baseline. Los cuatro servidores/aplicación deben ejecutarse localmente. Mantener una carpeta vacía para los JSON descargados.
2. En **Service → Servicios**, crear **Culto Domingo 19:00** con fecha `2026-10-11 19:00`. Agregar Bienvenida, Adoración, la prédica **Viviendo por fe**, Ofrenda y Cierre en ese orden; en Información poner **Templo Central** como sede. Seleccionar **Adoración** como ancla musical. Capturar el orden antes de la importación.
3. Descargar `WorshipContext 0.1` y abrir **LVM Worship → Repertorio**. Seleccionar ese JSON. Comprobar que Worship muestra el nombre del culto y un enlace para volver a Service. Importar [`m79d-cancion-a.cho`](../fixtures/m79d-cancion-a.cho), [`m79d-cancion-b.cho`](../fixtures/m79d-cancion-b.cho) y [`m79d-cancion-c.cho`](../fixtures/m79d-cancion-c.cho). Ordenar A/B/C, guardar y exportar `WorshipPlan 0.1`. Capturar el repertorio.
4. Volver a Service, seleccionar el WorshipPlan, revisar la lista previa y confirmar. Comprobar el orden final: Bienvenida, Adoración, Canción A, B, C, Viviendo por fe, Ofrenda, Cierre. Recargar y comprobar que permanece. Capturar el orden y el estado de importación.
5. En la pestaña **Presentación**, comprobar `Service válido` y descargar `Service 0.1`. Ejecutar el adaptador de Presenter: `node scripts/lvm/service-to-project.mjs <service.json> <demo.project>` desde el checkout de Presenter. Importar el `.project` desde la interfaz de Presenter, abrir el culto, seleccionar **Canción A** y una diapositiva, enviarla a la salida/preview, guardar, cerrar y reabrir. Capturar elementos y diapositiva. No es una transferencia automática entre aplicaciones: los archivos son parte explícita del recorrido.
6. En **Service → Contenido público**, completar **Encuentro Juvenil** (`2026-10-17`, `19:00`, Templo Central), la prédica **Viviendo por fe** y la sede **Templo Central**. Descargar `PublicContent 0.1` y abrir Web Pública → **Cargar preview**. Seleccionar el archivo, revisar las tres entidades y aplicarlo. Capturar Inicio, Eventos, Prédicas y Sedes a 1440 y 390 px. Comprobar que el contenido sobrevive a una recarga.
7. Repetir el intercambio con Internet desconectado, manteniendo loopback disponible. Cerrar Presenter y comprobar que no deja procesos o ventanas de prueba. Los estados de error deben ser comprensibles ante un archivo con versión futura; el contenido anterior debe conservarse.

## Gate y evidencia

| Criterio               | Evidencia requerida                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Recorrido automatizado | `npm run test:demo` verde; JSON y `.project` validados                                         |
| Recorrido manual       | Registro fechado de los siete pasos, sin errores ni crash                                      |
| Offline                | Solicitudes remotas bloqueadas en E2E; intercambio manual con red externa desconectada         |
| Capturas               | Service antes/después, Worship, Presenter, Service/PublicContent, Web Pública escritorio/móvil |
| Consistencia           | Títulos, orden y sede iguales al fixture en los cuatro productos                               |

La demo se considera cerrada funcionalmente con la corrida automatizada y la revisión manual del usuario registradas abajo. Las capturas automáticas complementan esa revisión.

### Verificación de 2026-10-08

- `npm run test:demo`: pasó Service → Worship → Service → Presenter y Service → Web Pública. Se bloquearon las solicitudes no locales; el proceso terminó con código 0.
- Capturas automáticas: `docs/screenshots/m79d/` incluye los cinco hitos del culto, la ventana de salida física de Presenter y seis vistas de Service/Web Pública.
- Inspección visual de capturas: los ocho elementos llegaron a Presenter, la canción A se ve en la preview de salida y Web Pública muestra el evento importado. La captura de Worship aún tiene etiquetas heredadas en inglés que dicen “Platform”; se registra para M7.9E.
- Recorrido manual de los cuatro productos: **pendiente de confirmación**. La herramienta de control del navegador interno no logró iniciar en esta sesión; no se infiere el resultado manual del test automatizado.

### QA manual de 2026-10-08 y correcciones en curso

La revisión visual del usuario no aprobó aún el recorrido completo. Service se ve coherente, pero mostraba `LVM Platform` en Servicios y exponía Contract Inspector en la navegación normal. Web Pública se ve bien para la preview; `Cargar preview` es una herramienta de esta fase y deberá ocultarse en la publicación final. Worship mostró una carga de canciones sin fin, un error de repertorios guardados y un error técnico de JSON en Lectura. Presenter no apareció en las capturas manuales entregadas: la captura automatizada `05-presenter-slide.png` prueba importación, ocho elementos, cuatro diapositivas de Canción A y preview, pero no sustituye la comprobación manual de la ventana de salida.

Las correcciones de Service y Worship se trabajan en ramas de QA de M7.9D. En Worship, **Lectura bíblica diaria** se considera una utilidad de lectura y plan bíblico del producto musical; los devocionales editables, publicaciones y CMS pertenecen a LVM Service. No se traslada contenido entre dominios en esta corrección. La denominación de navegación `Palabra del día` queda pendiente de revisión lingüística porque los archivos de traducción revisados por humanos no deben modificarse sin autorización explícita.

La repetición automatizada abrió Presenter sin DevTools, importó los ocho elementos, seleccionó Canción A y mostró “Cantamos con fe” en la salida física; la captura es [`05b-presenter-physical-output.png`](screenshots/m79d/05b-presenter-physical-output.png). Esto cubre el gate automático de proyección, pero no se presenta como QA humano.

Con el backend de demo inactivo, la inspección visual adicional registró los estados recuperables de [`/songs`](screenshots/m79d/worship-songs-fallback.png), [`/setlist`](screenshots/m79d/worship-setlist-fallback.png) y [`/reading`](screenshots/m79d/worship-reading-fallback.png). La biblioteca no ofrece datos remotos en este entorno; el borrador local y la importación de archivos ChordPro siguen disponibles. Ninguna de estas pantallas muestra ya un error de parser al usuario.

### Cierre funcional de M7.9D — 2026-10-08

En su segunda revisión de las capturas y del recorrido, el usuario confirmó Service, Web Pública y Presenter. En Presenter observó **Culto Domingo 19:00**, ocho elementos, cuatro diapositivas de **Canción A** y la salida con **«Cantamos con fe»**. El E2E automatizado también pasó. Con esa evidencia se cierra **M7.9D funcionalmente** y comienza M7.9E.

Worship conserva una limitación de la demo sin backend: el repertorio guardado independiente de un WorshipContext puede mostrar un error de carga. El flujo principal Service → Worship → Service funciona con archivos locales; el estado del repertorio independiente se registra para pulido en M7.9E. La lectura bíblica ya muestra un error comprensible y el cancionero vacío tiene estado explícito. Esto no implica que las pantallas dependientes de Supabase hayan sido verificadas con datos remotos.

Pendientes visuales para M7.9E: textos en inglés y doble menú en Presenter, coherencia de estados en Worship y ocultación de herramientas de desarrollo en la versión de producción. La ocultación de Contract Inspector ya está implementada en la rama QA de Service; debe conservarse al integrar el trabajo visual. M8 sigue fuera de alcance hasta el gate final de M7.x.
