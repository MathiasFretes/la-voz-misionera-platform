# Fichas V0 — administración

Fuente: `C:\la-voz-misionera-v0\src\admin\screens\*Screen.tsx`, `src/admin/navigation/WebAdminNavigator.tsx`, `src/admin/components/AdminLayout.tsx`. En navegador se usa `WebAdminNavigator` con sidebar y 14 entradas; las vistas comparten patrón lista/tabla, formulario de alta/edición, borrar, loading, error y avisos. Ese patrón es información UX, no código NativeBase reutilizable. **No se accedió con una cuenta admin ni se obtuvieron datos reales:** las 28 capturas de las vistas internas son previews del `dist` local con estado React de usuario simulado en memoria, sin credenciales ni operaciones de escritura. Documentan el renderizado de componentes, formularios y shell, pero no verifican permisos, datos cargados ni funcionamiento del CRUD. El sidebar web se usa incluso en viewport estrecho; la captura de 390 px evidencia texto vertical/overflow. Todos los CRUD dependen de Firebase/Firestore y de la sesión/rol del admin; el reemplazo requiere repository/API y auth de LVM, sin conectar Firestore V0.

## Acceso admin — REHACER

- **Archivo / usuarios:** `src/admin/components/AdminLayout.tsx` y `LoginForm`; editor/administrador.
- **Layout / secciones:** login email/contraseña; tras autenticación, sidebar con nombre/rol, navegación y cerrar sesión.
- **Acciones / estados:** iniciar sesión, mostrar/ocultar contraseña, error/carga, logout; acceso público oculto tras siete clics en la marca.
- **Datos / Firebase:** Firebase Auth y perfil/rol. No adoptar el gesto secreto como control de acceso ni el modelo de rol V0 sin diseño de permisos nuevo.
- **Assets / responsive / valoración:** marca y superficies oscuras; login se adapta, shell admin web no tiene drawer móvil. Preservar claridad de secciones, rehacer acceso/rutas/permisos.
- **Capturas:** [desktop](screenshots/admin-login-desktop.jpg) · [móvil](screenshots/admin-login-mobile.jpg).

## Eventos — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/EventosScreen.tsx`; equipo de agenda/operación.
- **Layout / secciones:** tabla de eventos y formulario lateral o modal de alta/edición; acciones por fila.
- **Acciones / estados:** crear, editar, eliminar, guardar/cancelar; suscripción, loader, error, éxito y confirmación de borrado.
- **Campos / Firebase:** `eventosService` suscribe; las mutaciones llaman directamente `addDoc`/`updateDoc`/`deleteDoc` sobre `eventos`: fecha, día abreviado, nombre, hora, categoría, color. Tipo/cupo/URL de inscripción/imagen/recurrencia figuran en el tipo, no todos en el formulario.
- **Assets / responsive / valoración:** color por categoría; formulario/lista NativeBase. Conservar edición rápida; reemplazar strings de fecha/hora y recurrencia incompleta por modelo validado y agenda pública coherente. `handleSave()` limpia `error` y cierra el editor aun tras `catch`: un fallo de guardado puede quedar oculto.
- **Capturas preview:** [desktop](screenshots/admin-eventos-desktop.jpg) · [móvil](screenshots/admin-eventos-mobile.jpg).

## Prédicas — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/PredicasScreen.tsx`; equipo de contenido.
- **Layout / secciones:** tabla de prédicas y formulario de edición.
- **Acciones / estados:** CRUD, confirmación, carga/error/éxito.
- **Campos / Firebase:** `predicasService`: título, pastor/a, serie, duración, fecha y URL; tipo añade audioUrl, videoUrl, thumbnailUrl, tags, views/isFeatured.
- **Assets / responsive / valoración:** URL de portada/medio, sin cargador de archivos verificado; conservar agrupación editorial, separar publicación de media y validar enlaces/metadatos.
- **Capturas preview:** [desktop](screenshots/admin-predicas-desktop.jpg) · [móvil](screenshots/admin-predicas-mobile.jpg).

## Pastores — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/PastoresScreen.tsx`; editor de organización.
- **Layout / secciones:** listado de perfiles y formulario.
- **Acciones / estados:** CRUD, ordenar, carga/error/éxito.
- **Campos / Firebase:** `pastoresService`: nombre, rol, orden; tipo añade foto, bio, emoji y color.
- **Assets / responsive / valoración:** foto URL o avatar/emoji; conservar perfil simple, comprobar bio/retrato/orden y relación futura con Personas antes de duplicar entidades.
- **Capturas preview:** [desktop](screenshots/admin-pastores-desktop.jpg) · [móvil](screenshots/admin-pastores-mobile.jpg).

## Ministerios — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/MinisteriosScreen.tsx`; editor de organización.
- **Layout / secciones:** tarjetas/lista y formulario.
- **Acciones / estados:** CRUD, orden, carga/error/éxito.
- **Campos / Firebase:** `ministeriosService`: emoji, nombre, coordinador, descripción, color hex y orden.
- **Assets / responsive / valoración:** emoji y color; conservar descripción/coordinador, validar que el color no fracture tokens LVM y relacionar coordinador con Personas solo cuando exista ese módulo.
- **Capturas preview:** [desktop](screenshots/admin-ministerios-desktop.jpg) · [móvil](screenshots/admin-ministerios-mobile.jpg).

## Células — REHACER

- **Archivo / usuarios:** `src/admin/screens/CelulasAdminScreen.tsx`; responsables de grupos.
- **Layout / secciones:** lista y formulario de célula.
- **Acciones / estados:** CRUD, carga/error/éxito, disponibilidad.
- **Campos / Firebase:** `celulasService`: nombre, líder, día, horario, zona, estado abierto/completo y cantidad.
- **Assets / responsive / valoración:** tarjetas/etiquetas de estado; conservar localización y disponibilidad, rehacer modelo de cupo, consentimiento y exposición pública de líder/datos.
- **Capturas preview:** [desktop](screenshots/admin-celulas-desktop.jpg) · [móvil](screenshots/admin-celulas-mobile.jpg).

## Sedes — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/SedesScreen.tsx`; equipo de organización.
- **Layout / secciones:** listado y formulario de sede.
- **Acciones / estados:** CRUD, orden, carga/error/éxito.
- **Campos / Firebase:** `sedesService`: nombre, dirección, pastor, teléfono, email; tipo incluye horarios, sede central y orden.
- **Assets / responsive / valoración:** no hay mapa operativo verificado; conservar ubicación y responsable, normalizar horarios y validar mapa/contacto antes de publicarlos.
- **Capturas preview:** [desktop](screenshots/admin-sedes-desktop.jpg) · [móvil](screenshots/admin-sedes-mobile.jpg).

## Radios — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/RadiosScreen.tsx`; editor de media.
- **Layout / secciones:** lista y formulario de emisora.
- **Acciones / estados:** CRUD, orden, carga/error/éxito.
- **Campos / Firebase:** `radiosService`: nombre, URL de streaming opcional y orden.
- **Assets / responsive / valoración:** nombre puede incluir emoji; conservar directorio pequeño, verificar reproductor/enlaces y decidir ubicación pública; no mezclar automáticamente con video en vivo.
- **Capturas preview:** [desktop](screenshots/admin-radios-desktop.jpg) · [móvil](screenshots/admin-radios-mobile.jpg).

## Estudios bíblicos — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/EstudiosScreen.tsx`; equipo editorial.
- **Layout / secciones:** lista y formulario de lectura.
- **Acciones / estados:** CRUD, orden, carga/error/éxito.
- **Campos / Firebase:** `estudiosService`: categoría, título, tiempo de lectura, contenido y orden.
- **Assets / responsive / valoración:** contenido textual; preservar clasificación y tiempo de lectura, diseñar publicación/preview y formato de texto sin depender del editor NativeBase.
- **Capturas preview:** [desktop](screenshots/admin-estudios-desktop.jpg) · [móvil](screenshots/admin-estudios-mobile.jpg).

## Redes sociales — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/RedesScreen.tsx`; comunicación.
- **Layout / secciones:** lista y formulario de canal.
- **Acciones / estados:** CRUD, orden, carga/error/éxito.
- **Campos / Firebase:** `redesService`: emoji/icono, nombre, handle, URL, color hex y orden.
- **Assets / responsive / valoración:** iconos/colores específicos de plataforma; conservar canal y handle, validar URL externa, destino y publicación.
- **Capturas preview:** [desktop](screenshots/admin-redes-desktop.jpg) · [móvil](screenshots/admin-redes-mobile.jpg).

## Devocionales — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/DevocionalesScreen.tsx`; equipo editorial.
- **Layout / secciones:** lista por fecha y formulario de devocional.
- **Acciones / estados:** CRUD, carga/error/éxito.
- **Campos / Firebase:** `devocionalesService`: fecha, versículo, referencia, título, contenido, aplicación y oración.
- **Assets / responsive / valoración:** texto largo; conservar estructura espiritual, validar fechas únicas, preview/publicación y conectar la vista pública que hoy usa texto embebido.
- **Capturas preview:** [desktop](screenshots/admin-devocionales-desktop.jpg) · [móvil](screenshots/admin-devocionales-mobile.jpg).

## Testimonios — REHACER

- **Archivo / usuarios:** `src/admin/screens/TestimoniosScreen.tsx`; moderador/editor.
- **Layout / secciones:** lista y formulario de testimonio.
- **Acciones / estados:** CRUD y aprobación, carga/error/éxito.
- **Campos / Firebase:** `testimoniosService`: autor, rol/título, iniciales, texto, foto URL, aprobado y fecha.
- **Assets / responsive / valoración:** foto o iniciales; preservar moderación explícita, rehacer consentimiento de publicación, revocación, trazabilidad y estados.
- **Capturas preview:** [desktop](screenshots/admin-testimonios-desktop.jpg) · [móvil](screenshots/admin-testimonios-mobile.jpg).

## Horarios de servicios — ADAPTAR

- **Archivo / usuarios:** `src/admin/screens/ServiceTimesScreen.tsx`; equipo de operación.
- **Layout / secciones:** lista y formulario de horario.
- **Acciones / estados:** CRUD, orden y activo/inactivo, carga/error/éxito.
- **Campos / Firebase:** `serviceTimesService`: día, hora 24 h, nombre, descripción, ubicación, activo, orden y recurrencia semanal/quincenal/mensual.
- **Assets / responsive / valoración:** etiquetas de recurrencia; conservar claridad del horario, modelar zona horaria/excepciones y relación con Eventos/Sedes. Evitar prometer recurrencia correcta solo por strings.
- **Capturas preview:** [desktop](screenshots/admin-horarios-desktop.jpg) · [móvil](screenshots/admin-horarios-mobile.jpg).

## Contenido general — REHACER

- **Archivo / usuarios:** `src/admin/screens/ContenidoScreen.tsx`; editor web.
- **Layout / secciones:** formularios agrupados para devocional del día, hero, live, CTA, donaciones y newsletter.
- **Acciones / estados:** cargar documentos y guardar bloques; carga/error/éxito, sin workflow editorial demostrado.
- **Campos / Firebase:** `contenidoService` sobre documentos `general` y `home`; ver [catálogo de campos](data-fields.md). Mezcla configuración, copy, enlaces y datos sensibles de donación.
- **Assets / responsive / valoración:** URLs de imágenes/video; preservar capacidad editorial, dividir por dominio/página y revisión de publicación. No portar formulario monolítico.
- **Capturas preview:** [desktop](screenshots/admin-contenido-desktop.jpg) · [móvil](screenshots/admin-contenido-mobile.jpg).

## Textos de páginas — REHACER

- **Archivo / usuarios:** `src/admin/screens/TextosPaginasScreen.tsx`; editor web.
- **Layout / secciones:** tabs Nosotros, Sedes, Oración, Boletín y Contacto con numerosos campos por página.
- **Acciones / estados:** cambiar tab, editar y guardar; carga/error/éxito.
- **Campos / Firebase:** `contenidoService` para `nosotros`, `sedes`, `oracion`, `boletin`, `contacto`; ver [catálogo](data-fields.md). No todas las pantallas públicas consumen estos documentos hoy.
- **Assets / responsive / valoración:** textos y URL de mapas/imagen; conservar edición contextual, rehacer como CMS modular con preview, control de publicación y trazabilidad.
- **Capturas preview:** [desktop](screenshots/admin-textos-desktop.jpg) · [móvil](screenshots/admin-textos-mobile.jpg).
