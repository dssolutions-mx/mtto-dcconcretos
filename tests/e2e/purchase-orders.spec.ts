import { test, expect } from '@playwright/test'

test.describe('Purchase Orders flows', () => {
  test('Purchases page loads and shows header', async ({ page }) => {
    await page.goto('/compras')
    await expect(page.getByRole('heading', { name: 'Órdenes de Compra' })).toBeVisible()
  })

  test('Services page loads and lists service orders table', async ({ page }) => {
    await page.goto('/servicios')
    await expect(page.getByText('Órdenes de Servicio')).toBeVisible()
  })

  test('PO details page renders if TEST_PO_ID set', async ({ page }) => {
    const poId = process.env.TEST_PO_ID
    test.skip(!poId, 'TEST_PO_ID not set')
    await page.goto(`/compras/${poId}`)
    await expect(page.locator('text=Orden de Compra')).toBeVisible()
  })
})


