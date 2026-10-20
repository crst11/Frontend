// Piezas comunes de las pruebas end to end (SCRUM-235): cuentas por la API, el codigo de verificacion de Mailpit e inicio de sesion por la pantalla.
import AxeBuilder from '@axe-core/playwright';
import { APIRequestContext, Page, expect, request } from '@playwright/test';

const MAILPIT = process.env.MAILPIT_URL ?? 'http://correo:8025';
export const CLAVE = 'ClaveSegura123!';
export const DOMINIO = '@ucundinamarca.edu.co';

/** Solo la parte antes de la arroba: la pantalla pone el dominio ella misma. */
export function usuarioNuevo(prefijo = 'e2e'): string {
  return `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}`;
}

/** El codigo de 6 digitos que llego al correo de Mailpit (sale en segundo plano: se espera a que llegue). */
export async function codigoDe(correo: string): Promise<string> {
  const api = await request.newContext();
  try {
    for (let intento = 0; intento < 60; intento++) {
      const busqueda = await api.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${correo}` } });
      const mensajes = ((await busqueda.json()) as { messages?: { ID: string }[] }).messages ?? [];
      if (mensajes.length > 0) {
        const detalle = await api.get(`${MAILPIT}/api/v1/message/${mensajes[0].ID}`);
        const coincidencia = /([0-9]{6})/.exec(((await detalle.json()) as { Text: string }).Text);
        if (coincidencia) {
          return coincidencia[1];
        }
      }
      await new Promise((fin) => setTimeout(fin, 300));
    }
  } finally {
    await api.dispose();
  }
  throw new Error(`No llego el codigo de verificacion de ${correo}`);
}

/** Una cuenta activa, creada por la API (registro, codigo de Mailpit y verificacion): lo rapido para las pruebas que no son del registro. */
export async function crearCuenta(api: APIRequestContext, usuario = usuarioNuevo()): Promise<string> {
  const correo = usuario + DOMINIO;
  const registro = await api.post('/api/publico/auth/registro', {
    data: { correo, contrasena: CLAVE, nombres: 'Prueba', apellidos: 'Automatica', aceptaTratamientoDatos: true },
  });
  expect(registro.status(), await registro.text()).toBe(201);
  const verificacion = await api.post('/api/publico/auth/verificacion', { data: { correo, codigo: await codigoDe(correo) } });
  expect(verificacion.status(), await verificacion.text()).toBe(200);
  return usuario;
}

/** Inicia sesion como lo hace una persona: escribe el correo y la clave y pulsa el boton. */
export async function iniciarSesion(page: Page, usuario: string, opciones: { personal?: boolean } = {}): Promise<void> {
  await page.goto('/cuenta/entrar');
  await page.getByLabel('Correo institucional').fill(usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  if (opciones.personal === false) {
    await page.getByLabel('Es mi dispositivo personal').uncheck();
  }
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/cuenta\/entrar/);
}

// WCAG 2.2 nivel AA: las etiquetas de axe para A y AA de las versiones 2.0, 2.1 y 2.2. Es el nivel que pide el proyecto ("accesible", guia §8).
const ETIQUETAS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Las violaciones de accesibilidad de lo que hay en pantalla ahora, en una lista legible (vacia = todo bien). Se compara con `toEqual([])`
 * para que el mensaje del fallo diga que regla, que tan grave es y en que elemento.
 */
export async function violacionesDeAccesibilidad(page: Page): Promise<string[]> {
  const resultado = await new AxeBuilder({ page }).withTags(ETIQUETAS_WCAG).analyze();
  return resultado.violations.map(
    (v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')} (${v.helpUrl})`,
  );
}

/** Una cuenta con el programa elegido y el Registro Academico importado: lo necesario para que las pantallas tengan datos que mostrar. */
export async function conHistorialImportado(page: Page, ejemplos: string): Promise<void> {
  await page.goto('/cuenta/plan-de-estudios');
  await page.getByRole('button', { name: 'Elegir este programa' }).click();
  await expect(page.getByRole('heading', { name: 'Ingeniería de Sistemas y Computación' })).toBeVisible();
  await page.goto('/cuenta/importar-reporte');
  await page.locator('input[type=file]').setInputFiles(`${ejemplos}/registro_academico_extendido_de_ejemplo.pdf`);
  await page.getByRole('button', { name: 'Confirmar y guardar' }).click();
  await page.getByRole('dialog').getByRole('button').first().click();
  await expect(page).toHaveURL(/\/cuenta\/historial/);
}
