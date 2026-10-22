import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
    await expect(page.getByRole('button', { name: '¿Dónde consigo ese archivo?' })).toBeVisible();
  });

  test('sin oferta no hay nada que escribir a mano: solo la zona de carga', async ({ page }) => {
    await expect(page.getByText('Toca aquí para elegir el archivo de la oferta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar otra materia' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Proponer horarios' })).toHaveCount(0);
  });

  test('sube la oferta, elige la mañana y el servidor le propone combinaciones', async ({ page }) => {
    await page.locator('#oferta-archivo').setInputFiles({
      name: 'pub_rep_val.html',
      mimeType: 'text/html',
      buffer: comoLoGuardaElNavegador(OFERTA_DE_EJEMPLO),
    });

    await page.getByLabel('Mi semestre').selectOption('1');
    await expect(page.getByText('ÁLGEBRA LINEAL (5 grupos)')).toBeVisible();
    await expect(page.getByText('FUNDAMENTOS DE ELECTRÓNICA (1 grupo)')).toBeVisible();
    // En cuanto hay materias elegidas la app ya puede proponer: no hay un paso intermedio.
    await expect(page.getByRole('heading', { name: 'Lo que prefiero' })).toBeVisible();
    expect(await violacionesDeAccesibilidad(page), 'sin violaciones de accesibilidad con la oferta cargada').toEqual([]);

    await page.getByRole('button', { name: 'Mañana' }).click();
    await page.getByRole('button', { name: 'Proponer horarios' }).click();

    await expect(page.getByRole('heading', { name: 'Opción 1' })).toBeVisible();
    await expect(page.getByText(/en la mañana/).first()).toBeVisible();
  });

  test('si elige la carpeta guardada, la app encuentra la tabla sola aunque esté el archivo de afuera', async ({ page }) => {
    // Un campo de carpeta (webkitdirectory) pide una carpeta de verdad: se arma una con lo que deja Ctrl+S.
    const carpeta = mkdtempSync(join(tmpdir(), 'oferta-'));
    writeFileSync(join(carpeta, 'Universidad Cundinamarca _ Sistema Institucional.html'), comoLoGuardaElNavegador(ARCHIVO_DE_AFUERA));
    writeFileSync(join(carpeta, 'pub_rep_val.html'), comoLoGuardaElNavegador(OFERTA_DE_EJEMPLO));
    await page.locator('#oferta-carpeta').setInputFiles(carpeta);

    await expect(page.getByLabel('Mi semestre')).toBeVisible();
    await expect(page.getByText('ÁLGEBRA LINEAL (5 grupos)')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lo que prefiero' })).toBeVisible();
  });

  test('si sube el archivo de afuera, la app le dice cuál subir', async ({ page }) => {
    await page.locator('#oferta-archivo').setInputFiles({
      name: 'Universidad Cundinamarca _ Sistema Institucional.html',
      mimeType: 'text/html',
      buffer: comoLoGuardaElNavegador(ARCHIVO_DE_AFUERA),
    });

    await expect(page.getByRole('alert')).toContainText('pub_rep_val.html');
    await expect(page.getByLabel('Mi semestre')).toHaveCount(0);
  });
});
