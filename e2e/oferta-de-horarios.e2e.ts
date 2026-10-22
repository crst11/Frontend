import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { crearCuenta, iniciarSesion, violacionesDeAccesibilidad } from './ayudas';

// SCRUM-243: la persona sube la oferta que guardo de «Consultar Horarios» y recibe propuestas del servidor real. La plataforma de la
// universidad guarda sus paginas en windows-1252 (un byte por letra), y asi se sube el archivo de ejemplo. datos/oferta-de-ejemplo.html es
// la misma tabla recortada que usan las pruebas unitarias (src/.../oferta/oferta-de-ejemplo.ts): el contenedor de Playwright solo ve e2e/.
const OFERTA_DE_EJEMPLO = readFileSync('datos/oferta-de-ejemplo.html', 'utf8');
// El archivo de «afuera» que se guarda con Ctrl+S: solo el marco, sin la tabla.
const ARCHIVO_DE_AFUERA =
  '<html><head><title>Universidad Cundinamarca</title></head><frameset rows="0,*"><frame name="topFrame" src="blank.html">' +
  '<frame name="mainFrame" src="pub_rep_val.html"></frameset></html>';
const comoLoGuardaElNavegador = (html: string): Buffer => Buffer.from(html, 'latin1');

test.describe('Armar mi horario con la oferta de la universidad', () => {
  test.beforeEach(async ({ page, request }) => {
    await iniciarSesion(page, await crearCuenta(request));
    await page.goto('/horario/armar');
    await expect(page.getByRole('heading', { name: 'Subir la oferta de la universidad' })).toBeVisible();
  });

  test('sube la oferta, elige la mañana y el servidor le propone combinaciones', async ({ page }) => {
    await page.getByLabel('Archivo de la página guardada').setInputFiles({
      name: 'pub_rep_val.html',
      mimeType: 'text/html',
      buffer: comoLoGuardaElNavegador(OFERTA_DE_EJEMPLO),
    });

    await page.getByLabel('Mi semestre').selectOption('1');
    await expect(page.getByText('ÁLGEBRA LINEAL (5 grupos)')).toBeVisible();
    await expect(page.getByText('FUNDAMENTOS DE ELECTRÓNICA (1 grupo)')).toBeVisible();
    expect(await violacionesDeAccesibilidad(page), 'sin violaciones de accesibilidad con la oferta cargada').toEqual([]);

    await page.getByRole('button', { name: 'Usar estas materias' }).click();
    await expect(page.getByLabel('Materia 1')).toHaveValue('ÁLGEBRA LINEAL');
    await page.getByRole('button', { name: 'Mañana' }).click();
    await page.getByRole('button', { name: 'Proponer horarios' }).click();

    await expect(page.getByRole('heading', { name: 'Opción 1' })).toBeVisible();
    await expect(page.getByText(/en la mañana/).first()).toBeVisible();
  });

  test('si sube el archivo de afuera, la app le dice cuál subir', async ({ page }) => {
    await page.getByLabel('Archivo de la página guardada').setInputFiles({
      name: 'Universidad Cundinamarca _ Sistema Institucional.html',
      mimeType: 'text/html',
      buffer: comoLoGuardaElNavegador(ARCHIVO_DE_AFUERA),
    });

    await expect(page.getByRole('alert')).toContainText('pub_rep_val.html');
    await expect(page.getByLabel('Mi semestre')).toHaveCount(0);
  });
});
