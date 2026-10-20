import { expect, test } from '@playwright/test';
import { crearCuenta, iniciarSesion } from './ayudas';

// El PDF es el de ejemplo de la coleccion de Postman del Backend (datos ficticios; ningun reporte real entra al repositorio, Ley 1581).
const REGISTRO = `${process.env.EJEMPLOS ?? '../Backend/docs/postman/ejemplos'}/registro_academico_extendido_de_ejemplo.pdf`;

test('elige su programa, importa el Registro Academico y ve su historial', async ({ page, request }) => {
  await iniciarSesion(page, await crearCuenta(request));

  await page.goto('/cuenta/plan-de-estudios');
  await page.getByRole('button', { name: 'Elegir este programa' }).click();
  await expect(page.getByRole('heading', { name: 'Ingeniería de Sistemas y Computación' })).toBeVisible();

  await page.goto('/cuenta/importar-reporte');
  await page.locator('input[type=file]').setInputFiles(REGISTRO);

  // Primero se muestra lo detectado y no se guarda nada hasta confirmar.
  await expect(page.getByRole('heading', { name: 'Esto encontramos en tu reporte' })).toBeVisible();
  await expect(page.getByText('2024 · segundo semestre')).toBeVisible();
  await expect(page.getByText('2025 · primer semestre')).toBeVisible();
  await expect(page.getByText('Álgebra Lineal')).toBeVisible();

  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  // Un aviso (SweetAlert) confirma que se guardo.
  await page.getByRole('dialog').getByRole('button').first().click();

  // El aviso lleva al historial: promedio y avance del reporte, y los semestres plegados hasta tocarlos.
  await expect(page).toHaveURL(/\/cuenta\/historial/);
  await expect(page.getByText('Promedio acumulado')).toBeVisible();
  await expect(page.getByText('31 de 153 créditos')).toBeVisible();
  // El semestre mas reciente viene abierto; los anteriores, plegados hasta tocarlos.
  const reciente = page.getByRole('button', { name: /2025 · primer semestre/ });
  await expect(reciente).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Cálculo Diferencial' })).toBeVisible();
  const anterior = page.getByRole('button', { name: /2024 · segundo semestre/ });
  await anterior.click();
  await expect(anterior).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: 'Álgebra Lineal' })).toBeVisible();
});

test('un archivo que no es un PDF se rechaza con un mensaje y no guarda nada', async ({ page, request }) => {
  await iniciarSesion(page, await crearCuenta(request));
  await page.goto('/cuenta/importar-reporte');
  await page.locator('input[type=file]').setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('esto no es un pdf') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Esto encontramos en tu reporte' })).toHaveCount(0);
});
