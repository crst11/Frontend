import { expect, Page, test } from '@playwright/test';
import { crearCuenta, iniciarSesion } from './ayudas';

// SCRUM-231: en un equipo compartido (una sala de computo) la sesion se cierra sola tras 15 minutos sin actividad. No se espera ese
// tiempo: el reloj del navegador se adelanta con page.clock.
const guardado = (page: Page, clave: string) => page.evaluate((k) => localStorage.getItem(k), clave);

test('en un dispositivo compartido la sesion se cierra tras 15 minutos sin actividad', async ({ page, request }) => {
  await page.clock.install();
  await iniciarSesion(page, await crearCuenta(request), { personal: false });
  expect(await guardado(page, 'cundiapp.dispositivo')).toBe('compartido');

  await page.clock.fastForward('16:00');

  await expect(page).toHaveURL(/\/cuenta\/entrar/);
  await expect(page.getByRole('dialog')).toContainText('15 minutos');
  // No queda nada del uso compartido para la siguiente persona.
  expect(await guardado(page, 'cundiapp.dispositivo')).toBeNull();
});

test('en un dispositivo personal la sesion sigue abierta aunque pase el mismo tiempo', async ({ page, request }) => {
  await page.clock.install();
  await iniciarSesion(page, await crearCuenta(request));
  expect(await guardado(page, 'cundiapp.dispositivo')).toBeNull();

  await page.clock.fastForward('16:00');

  await expect(page).not.toHaveURL(/\/cuenta\/entrar/);
});
