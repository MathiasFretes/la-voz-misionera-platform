# PublicContent 0.1 — preview local

**Owner:** LVM Service / Contenido y Operación. **Consumer:** LVM Web Pública.

Service exporta un archivo JSON que la Web Pública importa explícitamente. El archivo no publica datos, no autentica a nadie y no constituye un CMS ni una API. Service 0.1 y WorshipPlan 0.1 no cambian.

```json
{
  "schemaVersion": "0.1",
  "generatedAt": "2026-10-07T15:00:00.000Z",
  "events": [{
    "id": "encuentro-juvenil", "title": "Encuentro Juvenil", "date": "2026-10-17",
    "time": "19:00", "venue": "Sede Central", "kind": "encuentro",
    "description": "Descripción para la vista previa"
  }],
  "sermons": [],
  "venues": []
}
```

`events`, `sermons` y `venues` son listas ordenadas y pueden estar vacías. Cada entidad requiere un `id` único dentro de su lista. Fechas usan `YYYY-MM-DD`, horas `HH:mm` de 24 horas y `generatedAt` usa el formato de `Date#toISOString()`. `kind` admite `culto` o `encuentro`. Una prédica lleva `id`, `title`, `series`, `speaker`, `date`, `duration`, `summary`; una sede lleva `id`, `name`, `zone`, `address`, `hours`, `isMain` booleano. Todos los textos son obligatorios y no vacíos. Los parsers rechazan campos desconocidos y versiones futuras.

La Web Pública conserva fixtures locales como estado inicial o al restaurar la preview. Tras importar un archivo válido, todas las páginas leen exclusivamente ese documento local. Importar otro archivo reemplaza el documento anterior; no mezcla datos de orígenes diferentes. La interfaz muestra el origen como **archivo importado** y nunca afirma que el contenido esté publicado.

Las imágenes no viajan en 0.1: un JSON local no transportaría por sí solo los assets de forma portable. El campo y el flujo de media se definirán cuando exista almacenamiento/publicación de contenido. No incluir URLs inventadas ni imágenes V0 sin procedencia comprobada.

Implementaciones del parser: `src/contracts/publicContent.ts` en Service y `src/data/publicContent.ts` en Web Pública. Se verifican por igualdad de archivo y con un E2E que exporta desde Service, importa en Web y recorre Inicio/Eventos.
