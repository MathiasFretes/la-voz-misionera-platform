# Fichas V0 — experiencia pública

Fuente: `C:\la-voz-misionera-v0\src\screens\*Screen.tsx` y navegación en `src/screens/pageRouter.tsx`/`src/navigation/NavbarDesktop.tsx`. Los IDs son estados de navegación, no URLs. Las capturas muestran **primer viewport** del `dist` local preexistente a 1440×900 y 390×844; puede no reflejar cambios fuente sin compilar. Firestore respondió `permission-denied` en la sesión de captura, de modo que una lista vacía o en carga no prueba ausencia de contenido real. `DarkHeader` y `isDesktop` son patrones V0, no componentes para copiar. Los assets fotográficos de URL/fallback requieren verificación de origen.

## Inicio (`inicio`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/HomeScreen.tsx` y `src/screens/home/*`; visitantes y nuevos asistentes. Página de orientación, agenda y acceso a contenidos.
- **Layout / secciones:** hero con carrusel/CTA, horarios, misión, devocional, prédicas, eventos, ministerios, estadísticas, testimonios y footer.
- **Acciones / estados:** navegación a páginas, modal de video, formularios rápidos y toast; carga independiente por sección. Parte de las acciones son demostrativas.
- **Datos / Firebase:** hooks de ministerios, eventos, prédicas, contenido Home/Nosotros, testimonios aprobados, redes, horarios y stats. La composición mezcla contenido remoto y texto fallback. El carrusel usa `HERO_SLIDES` hardcodeado en `src/data/fallback.ts`, aunque exista un tipo/servicio `HeroSlide`.
- **Assets / responsive:** imagen o video de hero y tarjetas con imágenes/emoji; desktop hero ancho y navegación superior, móvil header/drawer/tab bar. Conservar jerarquía de bienvenida y accesos; separar bloques editoriales del dato operativo, verificar CTA y contenido real.
- **Capturas:** [desktop](screenshots/inicio-desktop.jpg) · [móvil](screenshots/inicio-mobile.jpg).

## Nosotros (`nosotros`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/NosotrosScreen.tsx`; visitante que conoce visión e identidad.
- **Layout / secciones:** cabecera oscura, visión, misión/valores e historia; tarjetas de valores.
- **Acciones / estados:** volver; carga de valores. Predomina lectura.
- **Datos / Firebase:** `useValores` (`number`, `title`, `desc`, `order`); parte del texto está embebido, mientras el admin ofrece textos editables que aquí no siempre se consumen.
- **Assets / responsive:** tipografía y bloques; `isDesktop` cambia tamaños/columnas. Preservar narrativa; unificar la fuente editorial y quitar duplicaciones de contenido.
- **Capturas:** [desktop](screenshots/nosotros-desktop.jpg) · [móvil](screenshots/nosotros-mobile.jpg).

## Pastores (`pastores`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/PastoresScreen.tsx`; visitante que busca liderazgo.
- **Layout / secciones:** cabecera, presentación y grilla de perfiles.
- **Acciones / estados:** volver y lectura de perfiles; carga/vacío ligados al hook.
- **Datos / Firebase:** `usePastores`: nombre, rol, bio, foto/emoji, color y orden.
- **Assets / responsive:** `photoUrl` o avatar fallback; grilla `isDesktop`. Conservar identificación de cada pastor; verificar retratos, biografías y orden editorial antes de publicar.
- **Capturas:** [desktop](screenshots/pastores-desktop.jpg) · [móvil](screenshots/pastores-mobile.jpg).

## Prédicas (`predicas`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/PredicasScreen.tsx`; visitante que descubre enseñanzas.
- **Layout / secciones:** cabecera, filtros por serie, tarjetas de sermones y CTA a biblioteca.
- **Acciones / estados:** filtrar, abrir modal/recurso, volver; loader al consultar. El botón «Ver biblioteca completa» tiene callback vacío en fuente: no asumir que navega.
- **Datos / Firebase:** `usePredicas`: título, pastor, serie, duración, fecha, URL de media, thumbnail, tags y vistas.
- **Assets / responsive:** thumbnails o fallback; lista/grilla según `isDesktop`. Preservar descubrimiento por serie; reparar CTA y validar enlaces de medios.
- **Capturas:** [desktop](screenshots/predicas-desktop.jpg) · [móvil](screenshots/predicas-mobile.jpg).

## Biblioteca (`biblioteca`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/BibliotecaScreen.tsx`; visitante que busca sermones anteriores.
- **Layout / secciones:** cabecera, búsqueda, filtro de año y resultados en tarjetas.
- **Acciones / estados:** buscar por título/predicador/serie, filtrar año, abrir modal, volver; loader.
- **Datos / Firebase:** `usePredicas`, misma fuente que Prédicas; no crear una segunda colección por esta vista.
- **Assets / responsive:** thumbnails; fila de filtros en desktop y columna en móvil. Conservar búsqueda, pero diseñar vacío y error explícitos y comprobar volumen/performance.
- **Capturas:** [desktop](screenshots/biblioteca-desktop.jpg) · [móvil](screenshots/biblioteca-mobile.jpg).

## En Vivo (`envivo`) — REHACER

- **Archivo / usuarios:** `src/screens/EnVivoScreen.tsx`; audiencia de transmisión.
- **Layout / secciones:** cabecera, gran panel de reproducción y accesos YouTube/Facebook.
- **Acciones / estados:** los botones principales muestran toasts («Abriendo YouTube», «YouTube», «Facebook»); no hay reproductor/estado en vivo verificado.
- **Datos / Firebase:** se invoca `useRadios`, pero `radios`/`radiosLoading` no alimentan la pantalla. El flujo visible de video está hardcodeado. Separar radio de video, estado real de emisión y enlaces confirmados.
- **Assets / responsive:** bloque oscuro con play visual; botones envuelven en móvil. Preservar prioridad de transmisión; rehacer integración, offline/no emisión/error y accesibilidad.
- **Capturas:** [desktop](screenshots/envivo-desktop.jpg) · [móvil](screenshots/envivo-mobile.jpg).

## Devocional (`devocional`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/DevocionalScreen.tsx`; lectores diarios.
- **Layout / secciones:** fecha, título, versículo, lectura/reflexión, aplicación y oración en formato largo.
- **Acciones / estados:** volver, descargar PDF y compartir; ambas acciones muestran toast demostrativo.
- **Datos / Firebase:** no usa `useDevocionales`; el texto visible está embebido. Existe colección/admin de devocionales que deberá ser fuente editorial futura.
- **Assets / responsive:** composición tipográfica con columnas/tamaños `isDesktop`. Conservar lectura serena; conectar dato real y resolver fecha/archivo/compartir.
- **Capturas:** [desktop](screenshots/devocional-desktop.jpg) · [móvil](screenshots/devocional-mobile.jpg).

## Sedes (`sedes`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/SedesScreen.tsx`; visitante que busca comunidad local.
- **Layout / secciones:** cabecera, selector de sede, detalle de dirección/pastor/horarios y CTA de mapa.
- **Acciones / estados:** seleccionar sede, volver, «abrir Google Maps» vía toast; pantalla de carga y lista vacía si faltan datos.
- **Datos / Firebase:** `useSedes`: nombre, dirección, pastor, teléfono, email, horarios, central y orden. Si la colección está vacía, `displaySedes` queda vacío; no hay sedes fallback.
- **Assets / responsive:** paneles según `isDesktop`; mapa es visual/enlace a validar. Conservar selector y detalle; definir URL de mapas verificable y relación con horarios de Operación.
- **Capturas:** [desktop](screenshots/sedes-desktop.jpg) · [móvil](screenshots/sedes-mobile.jpg).

## Ministerios (`ministerios`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/MinisteriosScreen.tsx`; visitante interesado en servir.
- **Layout / secciones:** cabecera, introducción y tarjetas de ministerios.
- **Acciones / estados:** volver y explorar; carga desde hook.
- **Datos / Firebase:** `useMinisterios`: emoji, nombre, coordinador, descripción, color y orden.
- **Assets / responsive:** iconografía emoji y cards; grilla/columna `isDesktop`. Preservar agrupación por ministerio; revisar canales de contacto y evitar colores arbitrarios fuera del sistema LVM.
- **Capturas:** [desktop](screenshots/ministerios-desktop.jpg) · [móvil](screenshots/ministerios-mobile.jpg).

## Células (`celulas`) — REHACER

- **Archivo / usuarios:** `src/screens/CelulasScreen.tsx`; personas que buscan un grupo.
- **Layout / secciones:** cabecera, explicación, tarjetas de grupos con zona/día/líder/estado y CTA de inscripción/liderazgo.
- **Acciones / estados:** «Formulario de registro» y «Formulario para liderar» son toasts; hay carga de grupos y badges abierto/completo.
- **Datos / Firebase:** `useCelulas`: nombre, horario, líder, estado, día, zona y cantidad. Son datos potencialmente personales; diseñar permisos y publicación deliberadamente.
- **Assets / responsive:** cards y chips, columnas `isDesktop`. Conservar descubrimiento por zona/horario; rehacer registro, capacidad/estado y privacidad.
- **Capturas:** [desktop](screenshots/celulas-desktop.jpg) · [móvil](screenshots/celulas-mobile.jpg).

## Oración (`oracion`) — REHACER

- **Archivo / usuarios:** `src/screens/OracionScreen.tsx`; visitante que comparte una petición sensible.
- **Layout / secciones:** cabecera, formulario (nombre, apellido, email, petición), confirmación.
- **Acciones / estados:** enviar cambia `submitted` local a verdadero; no hay envío a backend, validación robusta ni canal seguro demostrado.
- **Datos / Firebase:** ninguno en esta pantalla. Modelo futuro: contacto, texto, consentimiento, fecha/estado y política de retención, sin adoptar una colección V0 inexistente.
- **Assets / responsive:** sin imagen esencial; formulario de dos columnas a una (`isDesktop`). Preservar tono pastoral; rehacer privacidad, errores y confirmación real antes de habilitar.
- **Capturas:** [desktop](screenshots/oracion-desktop.jpg) · [móvil](screenshots/oracion-mobile.jpg).

## Calendario (`calendario`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/CalendarioScreen.tsx`; visitante que planifica asistencia.
- **Layout / secciones:** cabecera, calendario mensual con flechas, días y agenda/lista de eventos.
- **Acciones / estados:** cambiar mes, seleccionar día/evento (toast), volver; loader de eventos.
- **Datos / Firebase:** `useEventos`: fecha/día/nombre/hora/categoría/color; mes inicial fijado a marzo de 2026, por lo que debe partir de fecha actual o selección persistida.
- **Assets / responsive:** etiquetas/gradiente, grilla de calendario; revisar a 390 px la legibilidad y el foco. Conservar visión mensual y agenda; definir eventos recurrentes y enlaces reales.
- **Capturas:** [desktop](screenshots/calendario-desktop.jpg) · [móvil](screenshots/calendario-mobile.jpg).

## Donaciones (`donaciones`) — REHACER

- **Archivo / usuarios:** `src/screens/DonacionesScreen.tsx`; donantes.
- **Layout / secciones:** cabecera, montos rápidos, propósito, método de pago, datos bancarios e impacto.
- **Acciones / estados:** selección de monto local; «Donar ahora» solo muestra toast. No se inicia un pago.
- **Datos / Firebase:** sin hook; montos y datos bancarios aparecen embebidos. **No migrar números de cuenta/RUC sin validación institucional.**
- **Assets / responsive:** cards en columnas/columna (`isDesktop`). Preservar claridad de monto/destino; rehacer pago o instrucciones verificadas, confirmación y confianza.
- **Capturas:** [desktop](screenshots/donaciones-desktop.jpg) · [móvil](screenshots/donaciones-mobile.jpg).

## Boletín (`boletin`) — REHACER

- **Archivo / usuarios:** `src/screens/BoletinScreen.tsx`; suscriptores y lectores.
- **Layout / secciones:** cabecera, tarjeta de suscripción y lista de ediciones recientes.
- **Acciones / estados:** `email.includes('@')` produce toast de confirmación; ediciones hardcodeadas abren toast. No hay alta real.
- **Datos / Firebase:** ninguno aquí, pese a campos de contenido para boletín en tipos/admin.
- **Assets / responsive:** sin portada real, formulario fila/columna (`isDesktop`). Preservar intención de suscripción y archivo; rehacer consentimiento, confirmación y ediciones publicadas.
- **Capturas:** [desktop](screenshots/boletin-desktop.jpg) · [móvil](screenshots/boletin-mobile.jpg).

## Redes (`redes`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/RedesScreen.tsx`; personas que desean contactar o seguir canales.
- **Layout / secciones:** cabecera, tarjetas de redes e información de contacto.
- **Acciones / estados:** pulsar red muestra toast, no enlace real; carga de ambas fuentes.
- **Datos / Firebase:** `useRedes` (icono, nombre, handle, URL, color, orden) y `useContacto` (etiqueta, valor, tipo, orden).
- **Assets / responsive:** iconos/emoji y cards `isDesktop`. Conservar estructura de canales; validar URLs y fusionar datos de contacto duplicados con Contacto.
- **Capturas:** [desktop](screenshots/redes-desktop.jpg) · [móvil](screenshots/redes-mobile.jpg).

## Soy Nuevo (`nuevo`) — REHACER

- **Archivo / usuarios:** `src/screens/NuevoScreen.tsx`; primera visita.
- **Layout / secciones:** bienvenida, expectativas, formulario corto y CTA WhatsApp.
- **Acciones / estados:** «Registrar mi visita» y WhatsApp son toasts; no hay registro/envío real.
- **Datos / Firebase:** ninguno; inputs nombre, teléfono y preguntas/expectativas se pierden al salir.
- **Assets / responsive:** cabecera y tarjetas `isDesktop`; conservar ruta de bienvenida, rehacer envío, consentimiento, estados y contacto auténtico.
- **Capturas:** [desktop](screenshots/nuevo-desktop.jpg) · [móvil](screenshots/nuevo-mobile.jpg).

## Contacto (`contacto`) — ADAPTAR

- **Archivo / usuarios:** `src/screens/ContactoScreen.tsx` (**sin seguimiento en V0**); visitante con consulta.
- **Layout / secciones:** título, formulario y otras formas de contacto.
- **Acciones / estados:** valida campos no vacíos y `@`, simula envío tras 1,5 s con `Alert`, limpia formulario; no hay API de envío.
- **Datos / Firebase:** ninguno; nombre, email y mensaje locales. Datos de contacto están hardcodeados y pueden no coincidir con `useContacto`/textos admin.
- **Assets / responsive:** columna de máximo 600 px, sin breakpoint explícito; conservar formulario sencillo, verificar datos de contacto y conectar canal real.
- **Capturas:** [desktop](screenshots/contacto-desktop.jpg) · [móvil](screenshots/contacto-mobile.jpg).

## Privacidad (`privacidad`) — REHACER

- **Archivo / usuarios:** `src/screens/PrivacidadScreen.tsx` (**sin seguimiento en V0**); lectores de política.
- **Layout / secciones:** título, fecha y cinco secciones de texto legal.
- **Acciones / estados:** lectura; sin estados remotos ni Firebase.
- **Datos / assets / responsive:** contenido estático y layout de lectura. No tomar el texto como política legal aprobada: revisar tratamiento real de datos, canales, cookies, contacto y fecha antes de publicar.
- **Capturas:** [desktop](screenshots/privacidad-desktop.jpg) · [móvil](screenshots/privacidad-mobile.jpg).

## No encontrado (`notfound`) — PORTAR CASI IGUAL

- **Archivo / usuarios:** `src/screens/NotFoundScreen.tsx` (**sin seguimiento en V0**); visitante de ruta inválida.
- **Layout / secciones:** código 404, explicación y botón de vuelta.
- **Acciones / estados:** volver a inicio. En V0 existe como `PageId`, pero no hay router URL real; la nueva app debe enlazarlo a rutas HTTP/desconocidas.
- **Datos / Firebase / assets / responsive:** ninguno; composición simple centrada. Preservar mensaje y CTA, adaptar shell/tokens y semántica de navegación del nuevo sitio.
- **Capturas:** [desktop](screenshots/notfound-desktop.jpg) · [móvil](screenshots/notfound-mobile.jpg).
