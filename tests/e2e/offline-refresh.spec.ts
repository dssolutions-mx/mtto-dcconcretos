import { test, expect } from '@playwright/test'

/**
 * Offline refresh smoke test (Track G).
 *
 * Requires a production-like build with Serwist SW enabled:
 *   npm run build -- --webpack && npm run start
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- offline-refresh
 *
 * Skipped when TEST_LOGIN_USERNAME / TEST_LOGIN_PASSWORD are not set.
 */
test.describe('Offline refresh', () => {
  test('checklists page survives offline refresh without browser error', async ({
    page,
    context,
  }) => {
    const username = process.env.TEST_LOGIN_USERNAME
    const password = process.env.TEST_LOGIN_PASSWORD
    test.skip(!username || !password, 'TEST_LOGIN_USERNAME / TEST_LOGIN_PASSWORD not set')

    await page.goto('/login')
    await page.getByLabel(/usuario|email|correo/i).fill(username!)
    await page.getByLabel(/contraseña|password/i).fill(password!)
    await page.getByRole('button', { name: /iniciar|entrar|login/i }).click()

    await page.waitForURL(/\/(dashboard|checklists)/, { timeout: 30_000 })
    await page.goto('/checklists')

    await expect(page.locator('body')).not.toContainText(
      /no hay conexión a internet|dinosaur|ERR_INTERNET_DISCONNECTED/i
    )

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/no hay conexión a internet|dinosaur/i)

    await expect(page.locator('body')).toBeVisible()
  })
})
