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

  test('downloaded checklist can be opened offline (no redirect/error)', async ({
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

    // Prepare offline while online: downloads pending checklists into Dexie + warms SW.
    await page.goto('/checklists')
    const prepare = page.getByRole('button', { name: /preparar offline/i })
    await prepare.click()
    // Wait for the prepare toast (success or "nothing downloaded") to settle.
    await page.waitForTimeout(4000)

    // Go offline and reload so connectivity flips to offline on first paint.
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    // The offline checklist list should render (downloaded checklists UI), not a
    // browser error page. This guards the regression where offline mode failed to
    // surface downloaded checklists at all.
    const offlineList = page.getByText(/checklists disponibles offline/i)
    await expect(offlineList).toBeVisible({ timeout: 15_000 })

    // If at least one checklist was downloaded, opening it must render the execution
    // view inline (the original "opening a checklist offline does not work" bug:
    // it used to bounce back / error instead of showing the form).
    const runButton = page.getByRole('button', { name: /^ejecutar$/i }).first()
    if (await runButton.count()) {
      await runButton.click()
      await expect(
        page.getByRole('heading', { name: /ejecutar checklist/i }).or(
          page.getByText(/volver a la lista offline/i)
        )
      ).toBeVisible({ timeout: 15_000 })

      const body = await page.locator('body').innerText()
      expect(body).not.toMatch(/no está disponible offline|no hay conexión a internet|dinosaur/i)
    }
  })
})
