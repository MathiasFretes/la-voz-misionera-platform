# V0 — flujos, contenido y assets

Complemento del [mapa M7.6](../v0-migration-map.md). Fuente de inspección: `C:\la-voz-misionera-v0` en el estado descrito allí. Cada flujo indica qué se observa en el código; no implica que el backend V0 esté disponible ni que una acción simulada funcione en producción.

## Navegación pública

| Inicio                | Paso visible                                                                   | Resultado en V0                                                                                       | Decisión para LVM                                                                                       |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Navbar desktop        | Hover sobre Nosotros/Media/Comunidad; clic en subentrada                       | `onNavigate(PageId)` cambia `activePage` en memoria                                                   | Rutas URL reales, accesibles por teclado y compartibles; preservar agrupaciones útiles.                 |
| Cabecera móvil        | Hamburger abre drawer y tabs inferiores abren Inicio/Iglesia/Vivo/Sedes/Grupos | `activePage` en memoria; drawer siempre se cierra tras navegar                                        | Menú común responsive y cobertura de rutas. «Boletín» hoy cae en Privacidad por el `else` de `App.tsx`. |
| Hero Home             | CTA de cada slide                                                              | Navega a Soy Nuevo, En Vivo, Prédicas, Biblioteca, Células, Ministerios o Donaciones según slide fijo | Mantener objetivos de llegada; revisar copy y media de cada CTA.                                        |
| Prédicas → Biblioteca | Botón «Ver biblioteca completa»                                                | Callback vacío en `PredicasScreen.tsx`                                                                | Crear enlace real; reutilizar un catálogo de prédicas.                                                  |
| Menú/Brand → admin    | Siete toques/clics sobre marca                                                 | Activa `admin` en `PageRouter`; sin URL propia                                                        | Nueva ruta de acceso y auth explícita. El gesto oculto es descubrimiento, no seguridad.                 |
| 404                   | Botón «Volver al Inicio»                                                       | Cambia estado a `inicio`; no existe router URL                                                        | Conectar a ruta desconocida real.                                                                       |

`pageRouter.tsx` hace lazy load de las 19 pantallas públicas y el admin; `App.tsx` inicializa siempre `inicio`. Por eso un screenshot en `/` de V0 no valida deep links ni botón Atrás del navegador.

## Flujos de captación y comunicación

| Pantalla      | Dato recibido/acción                            | Efecto observado                                                      | Requisito de nueva implementación                                                                                |
| ------------- | ----------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Soy Nuevo     | Nombre, teléfono, preguntas/expectativas        | Toast de registro; no se guarda ni envía                              | Consentimiento, validación, entrega verificable, error/reintento y política de retención.                        |
| Oración       | Nombre, apellido, email, petición               | `submitted=true` local; muestra confirmación                          | Canal privado y seguro, moderación/acceso apropiado y confirmación solo tras entrega.                            |
| Contacto      | Nombre, email, mensaje                          | Validación básica y `setTimeout` de 1,5 s; limpia formulario          | Envío real, validación, estado de error y datos públicos verificados.                                            |
| Boletín       | Email                                           | Toast según `includes('@')`; ediciones hardcodeadas también son toast | Suscripción con consentimiento y confirmación; archivo real de ediciones.                                        |
| Donaciones    | Monto rápido y botón                            | Estado local y toast «Redirigiendo...»                                | No publicar instrucciones o cuentas embebidas sin verificación institucional; transacción/recibo real si aplica. |
| En Vivo/Redes | Botones a plataformas                           | Toast; no navegación/stream verificado                                | URL/estado de emisión reales y fallback fuera de emisión.                                                        |
| Home          | WhatsApp, Maps, registro, donación, suscripción | Varios CTA muestran toast                                             | Auditar cada CTA antes de reutilizarlo como promesa productiva.                                                  |

## Flujo editorial y brechas de fuente de verdad

1. Admin autenticado elige una de 14 vistas desde `WebAdminNavigator`. La mayoría se suscribe a datos mediante `firebaseService` y escribe por Firestore directo o por un servicio. El estado de guardado, error y confirmación no es uniforme; verificar cada acción durante su vertical slice.
2. `Eventos` administra agenda que consumen Home y Calendario. `ServiceTimes` administra horarios que consume Home. Son datos relacionados pero no equivalentes al `Service 0.1` de Presenter.
3. Admin `Predicas` y las pantallas públicas `Prédicas`/`Biblioteca` comparten el dominio `Predica`. Existe un tipo `Sermone` legado: no duplicar catálogo sin comprobar export de datos.
4. Admin `Devocionales` edita `Devocional`, pero la pantalla pública `DevocionalScreen` contiene texto fijo. Antes de migrarla, acordar el documento publicado del día y el archivo histórico.
5. Admin `Contenido` y `TextosPaginas` editan múltiples documentos de copy; varias pantallas públicas siguen usando texto embebido o fuentes distintas. El nuevo CMS debe indicar exactamente qué bloque alimenta qué pantalla y cuándo está publicado.
6. `HeroSlide` tiene tipo/servicio, pero el Home público lee `HERO_SLIDES` constante. El contrato de contenido del nuevo hero requiere revisión editorial, no una copia automática de la colección V0.

## Inventario inicial de assets

| Origen V0                                                                                        | Uso observable                                                                         | Tratamiento                                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `assets/icon.png`, `favicon.png`, `splash-icon.png`, `android-icon-*`                            | Iconos/splash de Expo                                                                  | Revisar si representan la marca actual; no llevar el contenedor Expo al nuevo stack.                                |
| `src/data/fallback.ts` slide 1                                                                   | Foto Unsplash `photo-1504052434569-70ad5836ab65`                                       | Confirmar derechos, variante y pertinencia antes de usarla en LVM.                                                  |
| `src/data/fallback.ts` slide 2                                                                   | Video Pexels `8041841`                                                                 | Confirmar derechos, peso, autoplay, poster y comportamiento offline.                                                |
| `src/data/fallback.ts` slides 3/4                                                                | Fotos Unsplash `photo-1529156069898-49953e39b3ac` y `photo-1488521787991-ed7bbaae773c` | Confirmar derechos y contenido editorial.                                                                           |
| Campos `photoUrl`, `thumbnailUrl`, `imageUrl`, `bgImage`, `bgVideo`, `logoUrl`, `boletinPortada` | Medios remotos administrables                                                          | Inventariar valores reales en la exportación V0; validar URL, licencia, consentimiento y destino de almacenamiento. |
| Emoji/iconos de pastor, ministerio, red, stats                                                   | Identificación visual y fallback                                                       | Conservar significado cuando aporte contexto; traducir a componentes/tokens LVM sin depender de fuentes Expo.       |

Las 40 capturas versionadas en `screenshots/` cubren el primer viewport de 19 pantallas públicas y el login admin en 1440×900/390×844. Se obtuvieron del `dist` local preexistente. No son capturas completas con scroll ni estados interactivos: para la implementación de cada slice se repetirán con datos representativos, vacío, error y móvil. Las 14 vistas admin requieren sesión autorizada para sus capturas de referencia; esta evidencia sigue pendiente.
