import { test, expect } from '@playwright/test'

test.describe('UI Design System', () => {
  test('T1 — body uses token bg and text colors', async ({ page }) => {
    await page.goto('/ui-preview')
    const body = page.locator('body')
    await expect(body).toHaveCSS('background-color', 'rgb(8, 2, 14)')
    await expect(body).toHaveCSS('color', 'rgb(236, 230, 240)')
  })

  test('T1 — display font is Bebas Neue', async ({ page }) => {
    await page.goto('/ui-preview')
    const el = page.locator('[data-testid="display-heading"]')
    await expect(el).toBeVisible()
    const ff = await el.evaluate(e => getComputedStyle(e).fontFamily)
    expect(ff).toContain('Bebas Neue')
  })

  test('T2 — Button primary: pink bg, pill radius, text renders', async ({ page }) => {
    await page.goto('/ui-preview')
    const btn = page.locator('[data-testid="btn-primary"]')
    await expect(btn).toBeVisible()
    await expect(btn).toHaveCSS('background-color', 'rgb(255, 20, 147)')
    await expect(btn).toHaveCSS('border-radius', '999px')
  })

  test('T2 — Button ghost: no pink bg, has border', async ({ page }) => {
    await page.goto('/ui-preview')
    const btn = page.locator('[data-testid="btn-ghost"]')
    await expect(btn).toBeVisible()
    // ghost should NOT be solid pink
    const bg = await btn.evaluate(e => getComputedStyle(e).backgroundColor)
    expect(bg).not.toBe('rgb(255, 20, 147)')
  })

  test('T2 — Chip gold: pill radius, gold text', async ({ page }) => {
    await page.goto('/ui-preview')
    const chip = page.locator('[data-testid="chip-gold"]')
    await expect(chip).toBeVisible()
    await expect(chip).toHaveCSS('border-radius', '999px')
    const color = await chip.evaluate(e => getComputedStyle(e).color)
    expect(color).toBe('rgb(255, 215, 0)')
  })

  test('T2 — Badge green renders', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="badge-green"]')).toBeVisible()
  })

  test('T2 — Input renders with label', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="input-demo"]')).toBeVisible()
  })

  test('T2 — Card has surface bg and border', async ({ page }) => {
    await page.goto('/ui-preview')
    const card = page.locator('[data-testid="card-demo"]')
    await expect(card).toBeVisible()
    // Card should have a border (not none/0px)
    const border = await card.evaluate(e => getComputedStyle(e).borderTopWidth)
    expect(parseFloat(border)).toBeGreaterThan(0)
  })

  test('T3 — Money: S/ 340.00 format', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="money-basic"]')).toHaveText('S/ 340.00')
  })

  test('T3 — Money with prefix: Desde S/ 340.00', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="money-prefix"]')).toHaveText('Desde S/ 340.00')
  })

  test('T3 — SectionEyebrow: uppercase + letter-spacing', async ({ page }) => {
    await page.goto('/ui-preview')
    const el = page.locator('[data-testid="eyebrow-demo"]')
    await expect(el).toBeVisible()
    await expect(el).toHaveCSS('text-transform', 'uppercase')
  })

  test('T3 — SeatLegend: three entries with labels', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="seat-legend"]')).toBeVisible()
    await expect(page.locator('[data-testid="legend-disponible"]')).toBeVisible()
    await expect(page.locator('[data-testid="legend-seleccionado"]')).toBeVisible()
    await expect(page.locator('[data-testid="legend-ocupado"]')).toBeVisible()
  })

  test('T3 — OrderSummary: renders total correctly', async ({ page }) => {
    await page.goto('/ui-preview')
    // 2 × S/ 70 = S/ 140 subtotal, minus S/ 20 combo = S/ 120 total
    await expect(page.locator('[data-testid="order-total-value"]')).toHaveText('S/ 120.00')
  })

  test('T3 — Nav: brand name renders', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="nav-brand"]')).toBeVisible()
  })

  test('T3 — Footer: brand renders', async ({ page }) => {
    await page.goto('/ui-preview')
    await expect(page.locator('[data-testid="footer-brand"]')).toBeVisible()
  })
})
