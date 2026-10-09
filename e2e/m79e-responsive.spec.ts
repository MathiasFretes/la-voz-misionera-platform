import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

test.skip(
  !process.env.LVM_SUITE_E2E || !process.env.LVM_PUBLIC_E2E,
  'Run with the local Service, Worship and public preview servers',
)

test('LVM web products keep their layout at 768 and 1024 px', async ({
  browser,
}) => {
  const captureDir = join(process.cwd(), 'docs', 'screenshots', 'm79e-v0')
  await mkdir(captureDir, { recursive: true })

  for (const width of [768, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    for (const product of [
      {
        name: 'service',
        url: 'http://127.0.0.1:4173/',
        menu: '.menu-trigger',
        motion: '.button',
      },
      {
        name: 'worship',
        url: 'http://127.0.0.1:4174/',
        menu: '.lvm-worship-nav__menu-button',
        motion: 'body',
      },
      {
        name: 'web',
        url: 'http://127.0.0.1:4175/',
        menu: '.menu-toggle',
        motion: '.button',
      },
    ]) {
      await page.goto(product.url, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('body')).toBeVisible()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width + 1)
      if (width === 768) {
        const menu = await page.locator(product.menu).boundingBox()
        expect(menu?.width).toBeGreaterThanOrEqual(44)
        expect(menu?.height).toBeGreaterThanOrEqual(44)
        await page.keyboard.press('Tab')
        const focus = await page.evaluate(() => {
          const element = document.activeElement
          if (!element || element === document.body) return null
          const style = getComputedStyle(element)
          return {
            visible: element.matches(':focus-visible'),
            width: Number.parseFloat(style.outlineWidth),
            style: style.outlineStyle,
          }
        })
        expect(focus?.visible).toBe(true)
        expect(focus?.style).not.toBe('none')
        expect(focus?.width).toBeGreaterThanOrEqual(2)
        await page.emulateMedia({ reducedMotion: 'reduce' })
        const duration = await page
          .locator(product.motion)
          .first()
          .evaluate((element) =>
            getComputedStyle(element)
              .transitionDuration.split(',')
              .map((value) => Number.parseFloat(value)),
          )
        expect(duration.every((seconds) => seconds <= 0.001)).toBe(true)
        await page.emulateMedia({ reducedMotion: 'no-preference' })
      }
      await page.screenshot({
        path: join(captureDir, `${product.name}-${width}.png`),
        fullPage: true,
      })
    }
    await page.close()
  }
})
