import { defineConfig, devices } from '@playwright/test';

// Pruebas end to end (SCRUM-235): un navegador real contra el Frontend de produccion servido por nginx y el backend real. Corren dentro del
// contenedor oficial de Playwright (ver ejecutar.sh), compartiendo la red del contenedor del frontend: la app se abre en localhost (contexto seguro) y el correo se alcanza por su nombre.
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.ts',
  outputDir: 'resultados/artefactos',
  // Cada prueba crea su propia cuenta, asi que no se estorban; pero el backend esta limitado a 1 CPU y 448 MiB (como en produccion) y el
  // hash de las contrasenas es caro: dos a la vez bastan para que dure poco sin falsear el tiempo de respuesta.
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'resultados/informe', open: 'never' }],
    ['junit', { outputFile: 'resultados/junit.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    // Telefono: la app es mobile-first desde 360 px de ancho.
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // El service worker se prueba aparte (sin-conexion.e2e.ts); en las demas solo estorba con su cache.
    serviceWorkers: 'block',
  },
  projects: [{ name: 'chromium' }],
});
