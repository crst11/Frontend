import { expect, test } from '@playwright/test';
import { CLAVE, codigoDe, DOMINIO, usuarioNuevo } from './ayudas';

test('una persona se registra, verifica su correo con el codigo que le llega e inicia sesion', async ({ page }) => {
  const usuario = usuarioNuevo('registro');
  const correo = usuario + DOMINIO;

  await page.goto('/cuenta/registro');
  await page.getByLabel('Nombres').fill('Camila');
  await page.getByLabel('Apellidos').fill('Rodriguez');
  await page.getByLabel('Correo institucional').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByLabel('Confirmar contraseña').fill(CLAVE);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Crear cuenta|Registrarme/ }).click();

  await expect(page).toHaveURL(/\/cuenta\/verificacion/);
  const codigo = await codigoDe(correo);
  await page.getByLabel('Dígito 1 de 6').click();
  await page.keyboard.type(codigo);
  await page.getByRole('button', { name: /Verificar/ }).click();
  await expect(page.getByText('Tu correo quedó verificado y tu cuenta está activa.')).toBeVisible();

  // Un aviso (SweetAlert) tapa la pagina: su boton lleva a la pantalla de inicio de sesion.
  await page.getByRole('dialog').getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/cuenta\/entrar/);
  await page.getByLabel('Correo institucional').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/cuenta\/entrar/);
});

test('una clave incorrecta no deja entrar y el mensaje no revela si el correo existe', async ({ page }) => {
  await page.goto('/cuenta/entrar');
  await page.getByLabel('Correo institucional').fill(usuarioNuevo('inexistente'));
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
  await expect(page).toHaveURL(/\/cuenta\/entrar/);
});
