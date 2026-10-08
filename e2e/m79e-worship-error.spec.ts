import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

test.skip(
  !process.env.LVM_SUITE_E2E,
  'Run against the local Worship preview with the offline QA endpoint',
)

test('Worship shows a recoverable library error without a backend', async ({
  browser,
}) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto('http://127.0.0.1:4174/songs', {
    waitUntil: 'domcontentloaded',
  })
  const feedback = page.locator('.lvm-song-library__feedback[role="alert"]')
  await expect(feedback).toBeVisible({ timeout: 15000 })
  await expect(feedback.getByRole('button')).toBeVisible()
  await expect(feedback).not.toContainText('Failed to fetch')
  await expect(feedback).not.toContainText('Unexpected token')
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(391)
  const directory = join(process.cwd(), 'docs', 'screenshots', 'm79e-v0')
  await mkdir(directory, { recursive: true })
  await page.screenshot({
    path: join(directory, 'worship-songs-error-390.png'),
  })
  await page.close()
})
