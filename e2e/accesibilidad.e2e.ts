import { expect, test } from '@playwright/test';
import { codigoDe, conHistorialImportado, crearCuenta, iniciarSesion, usuarioNuevo, violacionesDeAccesibilidad } from './ayudas';

// Fase 3 (SCRUM-237): axe-core revisa cada pantalla contra WCAG 2.2 AA, a 360 px de ancho (el minimo que pide el proyecto). No hay lista de
// excepciones: si una regla falla, se corrige la pantalla. Si algun dia hiciera falta una excepcion, va aqui, con el motivo, la regla y la
// fecha en que se revisa.
const EJEMPLOS = process.env.EJEMPLOS ?? '../Backend/docs/postman/ejemplos';

test.use({ viewport: { width: 360, height: 740 } });

const PANTALLAS_PUBLICAS = [
  '/',
  '/guia',
  '/cuenta/registro',
  '/cuenta/entrar',
  '/cuenta/verificacion',
  '/cuenta/recuperar',
  '/cuenta/nueva-contrasena',
];

const PANTALLAS_CON_SESION = [
  '/inicio',
  '/pendientes',
  '/cuenta/plan-de-estudios',
  '/cuenta/historial',
  '/cuenta/mi-cuenta',
  '/cuenta/mis-sesiones',
  '/importar',
  '/cuenta/importar-reporte',
  '/horario',
  '/horario/armar',
  '/avisos',
  '/avisos/configuracion',
  '/brujula',
  '/simulador',
  '/calificaciones/mis-notas',
];

async function auditar(page: import('@playwright/test').Page, ruta: string): Promise<string[]> {
  await page.goto(ruta);
  // La pantalla termino de cargar cuando ya no hay trabajo de red pendiente.
  await page.waitForLoadState('networkidle');
  return (await violacionesDeAccesibilidad(page)).map((v) => `${ruta}: ${v}`);
}

test.describe('Accesibilidad (WCAG 2.2 AA, 360 px)', () => {
  test('las pantallas publicas no tienen violaciones', async ({ page }) => {
    const violaciones: string[] = [];
    for (const ruta of PANTALLAS_PUBLICAS) {
      violaciones.push(...(await auditar(page, ruta)));
    }
    expect(violaciones).toEqual([]);
  });

  test('las pantallas con sesion no tienen violaciones', async ({ page, request }) => {
    await iniciarSesion(page, await crearCuenta(request));
    await conHistorialImportado(page, EJEMPLOS);

    const violaciones: string[] = [];
    for (const ruta of PANTALLAS_CON_SESION) {
      violaciones.push(...(await auditar(page, ruta)));
    }
    expect(violaciones).toEqual([]);
  });

  test('los errores de validacion tambien son accesibles', async ({ page }) => {
    await page.goto('/cuenta/registro');
    await page.getByRole('button', { name: /Crear cuenta|Registrarme/ }).click();
    await expect(page.getByRole('alert').or(page.locator('.field__error')).first()).toBeVisible();
    expect(await violacionesDeAccesibilidad(page)).toEqual([]);

    await page.goto('/cuenta/entrar');
    await page.getByLabel('Correo institucional').fill(usuarioNuevo('inexistente'));
    await page.getByLabel('Contraseña', { exact: true }).fill('ClaveSegura123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(await violacionesDeAccesibilidad(page)).toEqual([]);
  });

  test('el aviso emergente, el panel del perfil y el formulario de pendientes tambien lo son', async ({ page, request }) => {
    // El aviso emergente de "correo verificado" (SweetAlert) tapa la pagina: tambien se audita abierto.
    const usuario = usuarioNuevo('accesible');
    await page.goto('/cuenta/registro');
    // Se alarga la animacion del aviso (SCRUM-249) para que la prueba siempre mida en el peor caso: si axe corriera con el aviso a medio
    // aparecer, fallaria cada vez y no una de cada tantas. `violacionesDeAccesibilidad` espera a que termine antes de medir. El estilo
    // sobrevive porque el registro y la verificacion son la misma pagina (la navegacion es de Angular, no recarga).
    await page.addStyleTag({ content: '.swal2-popup, .swal2-styled { animation-duration: 2s !important; transition-duration: 2s !important; }' });
    await page.getByLabel('Nombres').fill('Camila');
    await page.getByLabel('Apellidos').fill('Rodriguez');
    await page.getByLabel('Correo institucional').fill(usuario);
    await page.getByLabel('Contraseña', { exact: true }).fill('ClaveSegura123!');
    await page.getByLabel('Confirmar contraseña').fill('ClaveSegura123!');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Crear cuenta|Registrarme/ }).click();
    await expect(page).toHaveURL(/\/cuenta\/verificacion/);
    await page.getByLabel('Dígito 1 de 6').click();
    await page.keyboard.type(await codigoDe(`${usuario}@ucundinamarca.edu.co`));
    await page.getByRole('button', { name: /Verificar/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await violacionesDeAccesibilidad(page)).toEqual([]);

    // Con sesion: el panel del perfil (un dialogo anclado al avatar) y el formulario para agregar un pendiente.
    await iniciarSesion(page, await crearCuenta(request));
    await page.getByRole('button', { name: /mi perfil/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await violacionesDeAccesibilidad(page)).toEqual([]);

    await page.goto('/pendientes');
    await page.getByRole('button', { name: 'Agregar un pendiente' }).click();
    await expect(page.getByLabel('¿Qué tienes que hacer?')).toBeVisible();
    expect(await violacionesDeAccesibilidad(page)).toEqual([]);
  });
});
