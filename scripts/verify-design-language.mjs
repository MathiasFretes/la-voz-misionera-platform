import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

const service = resolve('.')
const worship = process.env.WORSHIP_REPO
const presenter = process.env.PRESENTER_REPO
const web = process.env.PUBLIC_WEB_REPO
if (!worship || !presenter || !web) {
  throw new Error('Set WORSHIP_REPO, PRESENTER_REPO and PUBLIC_WEB_REPO')
}

const sources = [
  ['Service', join(service, 'design-system/tokens.css')],
  ['Worship', join(worship, 'packages/tokens/tokens.css')],
  ['Presenter', join(presenter, 'public/global.css')],
  ['Web Pública', join(web, 'src/styles.css')],
]
const expected = {
  '--lvm-brand-navy': '#1c2a39',
  '--lvm-brand-navy-raised': '#172033',
  '--lvm-brand-gold': '#c6a15b',
  '--lvm-gold-text-on-light': '#825c18',
  '--lvm-focus-ring': '#b4872e',
  '--lvm-space-1': '4px',
  '--lvm-space-2': '8px',
  '--lvm-space-3': '12px',
  '--lvm-space-4': '16px',
  '--lvm-space-6': '24px',
  '--lvm-space-8': '32px',
  '--lvm-space-12': '48px',
  '--lvm-radius-control': '8px',
  '--lvm-radius-card': '12px',
  '--lvm-radius-panel': '16px',
  '--lvm-motion-fast': '180ms',
  '--lvm-motion-normal': '220ms',
}

for (const [name, path] of sources) {
  const css = readFileSync(path, 'utf8')
  for (const [token, value] of Object.entries(expected)) {
    const declaration = css
      .match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]
      ?.trim()
      .toLowerCase()
    if (declaration !== value) {
      throw new Error(
        `${name}: ${token} is ${declaration ?? 'missing'}; expected ${value}`,
      )
    }
  }
  process.stdout.write(`${name}: shared brand tokens match\n`)
}
