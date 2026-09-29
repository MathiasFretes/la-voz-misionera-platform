## Cambio

<!-- Qué cambia y por qué. Qué problema del producto resuelve. -->

## Dominio / ownership

<!-- Ej.: Platform / Operación, Platform / Contenido, Web Pública, Worship, Presenter. -->

- Producto:
- Módulo:
- Entidad/dominio afectado:
- Fuente de verdad:

## Pantalla V0 equivalente

<!--
Para una pantalla nueva o reemplazada:
- enlazar su ficha en docs/v0/
- seleccionar la decisión de migración
- explicar qué se preservó, qué cambió y por qué.

Si no existe equivalente V0, indicarlo explícitamente.
-->

- Ficha V0:
- Decisión:
  - [ ] PORTAR CASI IGUAL
  - [ ] ADAPTAR
  - [ ] REHACER
  - [ ] DESCARTAR
  - [ ] No existe equivalente V0
- Se preservó:
- Cambió y motivo:
- Contenido/assets reutilizados:
- Contenido/assets descartados y motivo:

## Fuente de datos

<!--
No copiar Firebase/Firestore/NativeBase/arquitectura V0.
Indicar de dónde vienen realmente los datos en la nueva arquitectura.
-->

- Repository / API:
- Modelo:
- Dependencias:
- Migración de datos V0 requerida:
  - [ ] Sí
  - [ ] No
  - [ ] Pendiente

## Estados de interfaz

- [ ] Loading
- [ ] Vacío
- [ ] Error
- [ ] Éxito
- [ ] Disabled / permisos, si aplica
- [ ] Offline, si aplica

## Responsive y accesibilidad

- [ ] 1440 px
- [ ] 1024 px
- [ ] 768 px
- [ ] 390 px
- [ ] Sin overflow horizontal
- [ ] Navegación por teclado
- [ ] Focus visible
- [ ] Contraste según Design System
- [ ] Targets táctiles adecuados

## Evidencia

- Desktop:
- Móvil:
- Estado vacío:
- Estado error:
- Comparación con V0:

## Verificación

<!-- Aplicar el gate de docs/v0-migration-map.md cuando corresponda. -->

- Pruebas:
- Lint:
- Build:
- Dependencias de API, datos o migraciones:
- Riesgos / deuda pendiente:

## Fuera de alcance

<!-- Dejar explícito qué NO entra en este PR. -->
