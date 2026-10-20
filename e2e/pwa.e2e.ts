import { expect, test } from '@playwright/test';

// SCRUM-237: Lighthouse dejo de puntuar la PWA en su version 12, asi que lo que hace instalable a la app se comprueba aqui: manifiesto completo,
// iconos que existen de verdad, la declaracion en el HTML y un service worker activo con su lista de archivos.
test.use({ serviceWorkers: 'allow' });

interface Icono {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifiesto {
  name?: string;
  short_name?: string;
  description?: string;
  lang?: string;
  display?: string;
  start_url?: string;
  scope?: string;
  theme_color?: string;
  background_color?: string;
  icons?: Icono[];
}

const COLOR_HEXADECIMAL = /^#[0-9a-f]{6}$/i;

test.describe('PWA instalable', () => {
  test('el manifiesto esta completo y se declara en el HTML', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', COLOR_HEXADECIMAL);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);

    const respuesta = await request.get('/manifest.webmanifest');
    expect(respuesta.status()).toBe(200);
    const manifiesto = (await respuesta.json()) as Manifiesto;

    expect(manifiesto.name).toBe('CundiApp');
    expect(manifiesto.short_name).toBe('CundiApp');
    // El nombre corto es lo que se lee bajo el icono: 12 caracteres o menos.
    expect((manifiesto.short_name ?? '').length).toBeLessThanOrEqual(12);
    expect(manifiesto.description).toBeTruthy();
    expect(manifiesto.lang).toMatch(/^es/);
    expect(manifiesto.display).toBe('standalone');
    expect(manifiesto.start_url).toBeTruthy();
    expect(manifiesto.scope).toBeTruthy();
    // El color de la barra del sistema y de la pantalla de arranque de la app instalada.
    expect(manifiesto.theme_color).toMatch(COLOR_HEXADECIMAL);
    expect(manifiesto.background_color).toMatch(COLOR_HEXADECIMAL);
  });

  test('los iconos del manifiesto existen y son del tamano que dicen', async ({ request }) => {
    const manifiesto = (await (await request.get('/manifest.webmanifest')).json()) as Manifiesto;
    const iconos = manifiesto.icons ?? [];

    // Para que el navegador ofrezca instalarla hacen falta, como minimo, el de 192 y el de 512.
    const tamanos = iconos.map((icono) => icono.sizes);
    expect(tamanos).toContain('192x192');
    expect(tamanos).toContain('512x512');
    expect(iconos.some((icono) => (icono.purpose ?? '').includes('maskable'))).toBe(true);

    for (const icono of iconos) {
      const respuesta = await request.get(`/${icono.src}`);
      expect(respuesta.status(), `${icono.src} debe existir`).toBe(200);
      expect(respuesta.headers()['content-type'], icono.src).toContain(icono.type);
      expect((await respuesta.body()).length, `${icono.src} no debe estar vacio`).toBeGreaterThan(100);
    }
  });

  test('el service worker se activa y tiene su lista de archivos', async ({ page, request }) => {
    await page.goto('/');
    const estado = await page.evaluate(async () => {
      const registro = await navigator.serviceWorker.ready;
      return registro.active?.state ?? 'ninguno';
    });
    expect(estado).toBe('activated');

    const ngsw = await request.get('/ngsw.json');
    expect(ngsw.status()).toBe(200);
    const lista = (await ngsw.json()) as { index?: string; assetGroups?: unknown[]; hashTable?: Record<string, string> };
    expect(lista.index).toBe('/index.html');
    expect(lista.assetGroups?.length).toBeGreaterThan(0);
    expect(Object.keys(lista.hashTable ?? {}).length).toBeGreaterThan(5);
  });

  test('robots.txt es un robots.txt y no la pagina de la app', async ({ request }) => {
    const respuesta = await request.get('/robots.txt');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toContain('text/plain');
    const texto = await respuesta.text();
    expect(texto).toContain('User-agent: *');
    // Nada de cuentas ni de la API en los buscadores.
    expect(texto).toContain('Disallow: /api/');
    expect(texto).toContain('Disallow: /cuenta/');
  });
});
