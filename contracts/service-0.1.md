# LVM Service Contract 0.1

Platform owns the service and exports a single JSON object with `schemaVersion`, `id`, `title`, `startsAt`, `setlist`, and ordered `items`. This is the canonical specification during M6; Worship and Presenter keep compatibility tests against it. Runtime storage is local only.

`startsAt` is an ISO 8601 date/time with timezone. `setlist` has `{id,name}`. Every item has a unique `id`, a `kind`, and exactly one matching payload:

| Kind           | Payload        | Required fields                                   |
| -------------- | -------------- | ------------------------------------------------- |
| `SONG`         | `song`         | `id`, `title`, `key`, nonempty `sections`         |
| `SCRIPTURE`    | `scripture`    | `reference`, `version`, `text`; optional `source` |
| `ANNOUNCEMENT` | `announcement` | `title`, `body`                                   |
| `SERMON`       | `sermon`       | `title`, `body`                                   |

A song section has `{kind,label,lines}`. Each line has `{text,chords}`; a chord has `{symbol,index}`. `index` is a zero-based UTF-16 code-unit offset into `text`, between 0 and `text.length`, and must not split a surrogate pair. Repeated sections appear repeatedly in playback order. The contract has no venue, people, teams, media, timers, permissions, API identifiers, or FreeShow layout data. Platform stores venue locally as editor metadata and excludes it from the export.

`src/contracts/service.ts` validates every nested field and rejects unknown fields or future versions before export/import. `src/fixtures/demoService.ts` demonstrates the six-item offline M6 service. The scripture sample is an excerpt for a local fixture; production service authors are responsible for the text and rights of their materials.

## Handoff

Export a Service 0.1 JSON from Platform's Contract Inspector, then in Presenter run:

```powershell
npm run lvm:service-to-project -- C:\path\to\service.json C:\path\to\service.project
```

Import the `.project` file through Presenter's project import action. Worship is not part of the M6 runtime handoff.
