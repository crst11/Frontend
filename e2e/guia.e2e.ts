import { expect, test } from '@playwright/test';

// SCRUM-237: la Guia sumaba un desplazamiento de diseño de 0,29 porque las sugerencias, las categorias y los documentos llegan del servidor
// despues de pintar y empujaban hacia abajo los resultados y el aviso del final. Se retrasan las tres respuestas para que el salto sea visible aunque la red local sea rapida.
const RETRASO_MS = 800;

test('la Guia no se desplaza mientras llegan sus sugerencias, categorias y documentos', async ({ page }) => {
  for (const ruta of ['**/guia/sugerencias', '**/guia/categorias', '**/guia/recursos**']) {
    await page.route(ruta, async (peticion) => {
      await new Promise((resolver) => setTimeout(resolver, RETRASO_MS));
      await peticion.continue();
    });
  }
  await page.addInitScript(() => {
    const medida = window as unknown as { __cls: number };
    medida.__cls = 0;
    new PerformanceObserver((lista) => {
      for (const entrada of lista.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entrada.hadRecentInput) {
          medida.__cls += entrada.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto('/guia');
  await expect(page.getByRole('group', { name: 'Filtrar por categoría' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Búsquedas sugeridas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reglamentos' }).first()).toBeVisible();
  await page.waitForTimeout(300);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls, 'lo bueno es menos de 0,1').toBeLessThan(0.1);
});
