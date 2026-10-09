# M8 Final Gate — Backend / Persistencia

**Estado:** candidato a cierre. La fuente de evidencia es el workflow `Platform` ejecutado desde `main`, no una captura de la interfaz ni una prueba con datos simulados.

## Matriz de verificación

| Requisito                                                    | Evidencia ejecutable                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base nueva, migraciones 001 y 002, API y registro de control | El servicio PostgreSQL 17 de `.github/workflows/ci.yml` comienza vacío; `db:migrate` crea el esquema y `backend/src/foundation.test.ts` inserta el registro. La segunda ejecución de migraciones debe devolver `[]`.                                                                                   |
| Crear, editar, reordenar, recargar y borrar                  | `backend/src/foundation.test.ts` recorre la API con PostgreSQL, verifica el orden guardado con una nueva instancia del repositorio y comprueba el 404 después de borrar. `e2e/service-postgres.spec.ts` crea desde el Editor, importa repertorio, borra `localStorage` y vuelve a cargar desde la API. |
| Escritura y borrado atrasados                                | La integración PostgreSQL exige HTTP 409 para actualización y eliminación con revisión obsoleta. Las pruebas de `ApiServiceRepository` comprueban que el borrador local permanece descargable y la versión remota no cambia.                                                                           |
| WorshipContext 0.1, WorshipPlan 0.1 y Service 0.1            | `e2e/service-postgres.spec.ts` descarga el contexto, importa un plan con repeticiones, acentos y acordes, exporta Service después de recargar y lo convierte con el adapter real de Presenter fijado en CI.                                                                                            |
| PublicContent 0.1                                            | `test:public-preview` compara los parsers de Service y Web Pública y ejecuta el intercambio de archivo y la preview en navegador. Este contrato es independiente de los registros Service y del modo PostgreSQL.                                                                                       |
| Recuperación íntegra                                         | `test:db-ops` toma una instantánea de `services`, `service_items` ordenados y `schema_migrations`, crea un backup, elimina un servicio de control, restaura y exige igualdad exacta de las tres tablas. También rechaza un nombre de base de confirmación incorrecto.                                  |

## Baseline que se congela

M8 persiste `ServiceRecord` mediante API y PostgreSQL. `Service 0.1`, `WorshipContext 0.1`, `WorshipPlan 0.1` y `PublicContent 0.1` conservan sus versiones y límites. `revision`, `venue` y `worshipAfterItemId` son metadata de LVM Service; no entran en el archivo Service 0.1. El modo navegador local y los intercambios por archivo siguen disponibles.

El cierre de M8 no implica despliegue público, identidad de usuarios, permisos, CMS ni una restauración probada en un VPS. La API actual escucha en loopback y no debe exponerse a Internet antes del track de seguridad. La infraestructura real y las aplicaciones Android son tracks posteriores.
