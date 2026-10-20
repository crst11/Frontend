import { expect, test } from '@playwright/test';
import { crearCuenta, iniciarSesion } from './ayudas';

// RF12: lo que la persona ya consulto se puede volver a ver sin internet. Hace falta el service worker, que solo se registra en un contexto
// seguro (localhost) y sobre la compilacion de produccion: por eso estas pruebas corren sobre el contenedor real del frontend.
test.use({ serviceWorkers: 'allow' });

test('sin conexion la app abre y muestra lo que ya habia consultado', async ({ page, request, context }) => {
  await iniciarSesion(page, await crearCuenta(request));
  await page.goto('/pendientes');
  await page.getByRole('button', { name: 'Agregar un pendiente' }).click();
  await page.getByLabel('¿Qué tienes que hacer?').fill('Taller sin red');
  await page.getByLabel('Día límite').fill('2026-12-01');
  await page.getByRole('button', { name: 'Guardar pendiente' }).click();
  await expect(page.getByRole('list', { name: 'Tus pendientes' })).toContainText('Taller sin red');

  // El service worker toma el control de la pagina y la lista queda guardada en el dispositivo (IndexedDB) al leerla.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Tus pendientes' })).toContainText('Taller sin red');

  await context.setOffline(true);
  await page.reload();

  // Abre sin red, con el cascaron que sirve el service worker, y muestra la copia local.
  await expect(page.getByText('Mis pendientes')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Tus pendientes' })).toContainText('Taller sin red');
  await expect(page.getByText(/sin conexión/i).first()).toBeVisible();
});

test('en un dispositivo compartido no se guarda nada para consultar sin conexion', async ({ page, request }) => {
  await iniciarSesion(page, await crearCuenta(request), { personal: false });
  await page.goto('/pendientes');
  await expect(page.getByText('No tienes pendientes')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);

  // SCRUM-231: ninguna base local con datos de la persona queda en un equipo de otras personas.
  const bases = await page.evaluate(async () => (await indexedDB.databases()).map((base) => base.name));
  const copiaLocal = bases.filter((nombre): nombre is string => nombre !== undefined && !nombre.startsWith('ngsw'));
  for (const nombre of copiaLocal) {
    const filas = await page.evaluate(
      (base) =>
        new Promise<number>((resolver) => {
          const abrir = indexedDB.open(base);
          abrir.onsuccess = () => {
            const almacenes = Array.from(abrir.result.objectStoreNames);
            if (almacenes.length === 0) {
              resolver(0);
              return;
            }
            const transaccion = abrir.result.transaction(almacenes, 'readonly');
            let total = 0;
            let pendientes = almacenes.length;
            for (const almacen of almacenes) {
              const conteo = transaccion.objectStore(almacen).count();
              conteo.onsuccess = () => {
                total += conteo.result;
                if (--pendientes === 0) {
                  resolver(total);
                }
              };
            }
          };
          abrir.onerror = () => resolver(-1);
        }),
      nombre,
    );
    expect(filas, `la base local ${nombre} no debe tener filas`).toBeLessThanOrEqual(0);
  }
});
