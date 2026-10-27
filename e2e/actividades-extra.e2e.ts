import { expect, test } from '@playwright/test';
import { crearCuenta, iniciarSesion } from './ayudas';

const DIAS_EN_ESPANOL: Record<string, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

/** El día de hoy en la zona de Bogotá, como se lee en el botón del día («Lunes»). */
function hoy(): string {
  const nombre = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Bogota' });
  return DIAS_EN_ESPANOL[nombre];
}

test.describe('Actividades extra (SCRUM-266)', () => {
  test.beforeEach(async ({ page, request }) => {
    await iniciarSesion(page, await crearCuenta(request));
    await page.goto('/horario');
    await expect(page.getByRole('heading', { name: 'Actividades extra' })).toBeVisible();
  });

  test('añade una actividad extra sin tener asignaturas, la ve en el horario y la quita', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir actividad extra' }).click();

    // La guía de tres pasos y la aclaración de que no cuenta como asignatura.
    const formulario = page.getByRole('form', { name: 'Añadir una actividad extra' });
    await expect(formulario.getByText('Escribe qué es')).toBeVisible();
    await expect(formulario.getByText('no tiene notas ni cuenta en tu Brújula Académica')).toBeVisible();

    // Sin nombre, días ni horas no deja guardar.
    await expect(formulario.getByRole('button', { name: 'Añadir', exact: true })).toBeDisabled();

    await formulario.getByLabel('¿Qué es?').fill('Clase de baile');
    await formulario.getByRole('button', { name: new RegExp(`, ${hoy()}$`) }).click();
    await formulario.getByLabel('Desde').fill('17:00');
    await formulario.getByLabel('Hasta').fill('19:00');
    await formulario.getByLabel('Lugar').fill('Coliseo');
    await formulario.getByRole('button', { name: 'Añadir', exact: true }).click();

    // El horario abre en el día de la actividad y la muestra como una clase más.
    const tarjeta = page.locator('.horario__clase', { hasText: 'Clase de baile' });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText('Actividad extra');
    await expect(tarjeta).toContainText('17:00 – 19:00');
    await expect(tarjeta).toContainText('Coliseo');
    await expect(tarjeta).not.toContainText('calificar');

    // Quitarla pide confirmar y la saca del horario.
    await tarjeta.getByRole('button', { name: 'Quitar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Quitar' }).click();
    await expect(page.locator('.horario__clase', { hasText: 'Clase de baile' })).toHaveCount(0);
  });

  test('un rechazo del servidor se muestra junto al formulario sin cerrarlo', async ({ page }) => {
    await page.getByRole('button', { name: 'Añadir actividad extra' }).click();
    const formulario = page.getByRole('form', { name: 'Añadir una actividad extra' });
    await formulario.getByLabel('¿Qué es?').fill('Semillero');
    await formulario.getByRole('button', { name: new RegExp(`, ${hoy()}$`) }).click();
    // Termina antes de empezar: el servidor lo rechaza y la pantalla explica por qué.
    await formulario.getByLabel('Desde').fill('19:00');
    await formulario.getByLabel('Hasta').fill('17:00');
    await formulario.getByRole('button', { name: 'Añadir', exact: true }).click();

    await expect(formulario.getByRole('alert')).toBeVisible();
    await expect(formulario).toBeVisible();
  });
});
