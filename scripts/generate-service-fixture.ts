import { mkdir, writeFile } from 'node:fs/promises'
import { demoService } from '../src/fixtures/demoService'
import { exportService } from '../src/domain/service/service'

const service = exportService(demoService)
await mkdir(new URL('../fixtures/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../fixtures/platform-service.json', import.meta.url),
  `${JSON.stringify(service, null, 2)}\n`,
)
console.log(`Generated ${service.id}: ${service.items.length} items`)
