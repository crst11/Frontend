import { expect, test } from '@playwright/test';

// SCRUM-237: las tipografias se sirven desde la propia app. Asi no se le manda la IP de cada estudiante a un tercero.
test('las tipografias salen de la propia app y nada se pide a Google', async ({ page }) => {
  const externas: string[] = [];
  const fuentes: string[] = [];
  page.on('request', (peticion) => {
    const url = new URL(peticion.url());
    if (url.hostname !== 'localhost') {
      externas.push(peticion.url());
    }
    if (url.pathname.endsWith('.woff2')) {
      fuentes.push(url.pathname);
    }
  });

  await page.goto('/guia');
  await page.evaluate(() => document.fonts.ready);

  expect(externas, 'ninguna peticion debe salir del dominio de la app').toEqual([]);
  expect(fuentes).toEqual(expect.arrayContaining(['/fonts/outfit-latin.woff2', '/fonts/dm-sans-latin.woff2']));

  const cargadas = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((fuente) => fuente.status === 'loaded')
      .map((fuente) => fuente.family.replaceAll('"', '')),
  );
  expect(cargadas).toEqual(expect.arrayContaining(['Outfit', 'DM Sans']));
});
