import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const output = join(process.cwd(), 'docs', 'screenshots', 'm79e')
await mkdir(output, { recursive: true })
const apps = [
  ['service', 'http://127.0.0.1:4173/'],
  ['worship', 'http://127.0.0.1:4174/setlist'],
  ['web', 'http://127.0.0.1:4175/'],
]
if (process.env.LVM_SERVICE_PRODUCTION_URL) {
  apps.push(['service-production', process.env.LVM_SERVICE_PRODUCTION_URL])
}
const browser = await chromium.launch()
try {
  for (const [name, url] of apps) {
    for (const [size, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 844],
    ]) {
      const context = await browser.newContext({ viewport: { width, height } })
      await context.route(/https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      if (name === 'worship') {
        await page.locator('.lvm-worship-nav__brand').waitFor({ state: 'visible', timeout: 20_000 })
      }
      if (name === 'service-production' && await page.getByText('Contract Inspector').count()) {
        throw new Error('Contract Inspector is visible in production navigation')
      }
      await page.screenshot({ path: join(output, `${name}-${size}.png`) })
      const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.innerWidth)
      if (overflow > 1) throw new Error(`${name} ${size} overflows by ${overflow}px`)
      await context.close()
    }
  }
} finally {
  await browser.close()
}
process.stdout.write(`Captured ${apps.map(([name]) => name).join(', ')} shells in ${output}\n`)
