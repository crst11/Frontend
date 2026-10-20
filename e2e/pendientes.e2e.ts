import { expect, test } from '@playwright/test';
import { crearCuenta, iniciarSesion } from './ayudas';

/** El dia de manana en la zona de Bogota (YYYY-MM-DD), que es lo que entiende la casilla de fecha. */
function manana(): string {
  const dia = new Date(Date.now() + 24 * 3600 * 1000);
  return dia.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

test.describe('Mis pendientes', () => {
  test.beforeEach(async ({ page, request }) => {
    await iniciarSesion(page, await crearCuenta(request));
    await page.goto('/pendientes');
    await expect(page.getByText('No tienes pendientes')).toBeVisible();
  });

  test('crea un pendiente, lo marca como hecho, lo reabre y lo borra', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar un pendiente' }).click();
    await page.getByLabel('¿Qué tienes que hacer?').fill('Taller de redes');
    await page.getByLabel('Día límite').fill(manana());
    await page.getByLabel('Hora').fill('10:00');
    await page.getByRole('button', { name: 'Guardar pendiente' }).click();

    const lista = page.getByRole('list', { name: 'Tus pendientes' });
    await expect(lista).toContainText('Taller de redes');

    // Hecho: sale de la lista (los hechos se ven solo si se piden).
    await page.getByLabel('Marcar como hecho Taller de redes').check();
    await expect(page.getByLabel('Marcar como hecho Taller de redes')).toHaveCount(0);
    await page.getByLabel('Ver también los hechos').check();
    await expect(page.getByLabel('Reabrir Taller de redes')).toBeChecked();

    // Reabrirlo lo devuelve a la lista de pendientes.
    await page.getByLabel('Reabrir Taller de redes').uncheck();
    await expect(page.getByLabel('Marcar como hecho Taller de redes')).not.toBeChecked();

    await page.getByRole('button', { name: 'Borrar Taller de redes' }).click();
    // Pide confirmar antes de borrar.
    await page.getByRole('dialog').getByRole('button', { name: /Borrar|Sí|Eliminar/ }).click();
    await expect(lista).toHaveCount(0);
    await expect(page.getByText('No tienes pendientes')).toBeVisible();
  });

  test('no deja guardar un pendiente sin titulo ni fecha', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar un pendiente' }).click();
    await page.getByRole('button', { name: 'Guardar pendiente' }).click();
    await expect(page.getByText('Escribe un título para el pendiente.')).toBeVisible();
    await expect(page.getByText('Elige el día límite.')).toBeVisible();
  });
});
