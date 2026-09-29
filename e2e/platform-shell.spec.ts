import { expect, test } from '@playwright/test'

test('desktop shell uses shared tokens and real navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  const sidebar = page.getByLabel('Navegación principal')
  await expect(sidebar).toBeVisible()
  const colors = await sidebar.evaluate((element) => ({
    actual: getComputedStyle(element).backgroundColor,
    expected: getComputedStyle(document.documentElement)
      .getPropertyValue('--lvm-brand-navy')
      .trim(),
  }))
  expect(colors.actual).toBe('rgb(14, 26, 43)')
  expect(colors.expected).toBe('#0e1a2b')

  await sidebar.getByRole('link', { name: 'Servicios' }).click()
  await expect(
    page.getByRole('heading', { name: 'Servicios', exact: true }),
  ).toBeVisible()
  await expect(
    sidebar.getByRole('link', { name: 'Servicios' }),
  ).toHaveAttribute('aria-current', 'page')
})

test('mobile drawer navigates and closes without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByLabel('Navegación principal')).toBeHidden()
  const menu = page.getByRole('button', { name: 'Abrir menú' })
  await menu.click()
  await expect(
    page.getByRole('button', { name: 'Cerrar menú' }).first(),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Secciones' })
    .getByRole('link', { name: 'Servicios' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Servicios', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()

  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.keyboard.press('Shift+Tab')
  await expect(
    page
      .getByRole('dialog', { name: 'Menú principal' })
      .getByRole('link', { name: 'Contract Inspector' }),
  ).toBeFocused()
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(page.getByLabel('Navegación principal')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()

  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()

  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false)
  }
})
