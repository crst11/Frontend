import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { CierreDeSesion } from '../../../core/session/cierre-de-sesion.service';
import { SessionService } from '../../../core/session/session.service';
import { AppShell } from './app-shell';

@Component({ template: '<p class="hija">Contenido</p>' })
class Hija {}

describe('AppShell', () => {
  const cierre = { conConfirmacion: vi.fn() };

  async function crear(cuenta: { nombres: string; apellidos: string; correo: string } | null = {
    nombres: 'Cristian Albeiro',
    apellidos: 'Morales Urrea',
    correo: 'calbeiromorales@ucundinamarca.edu.co',
  }) {
    cierre.conConfirmacion.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: AppShell,
            children: [
              { path: 'inicio', component: Hija, data: { titulo: 'Hoy' } },
              { path: 'horario', component: Hija, data: { titulo: 'Mi horario' } },
            ],
          },
        ]),
        { provide: SessionService, useValue: { cuenta: signal(cuenta) } },
        { provide: CierreDeSesion, useValue: cierre },
      ],
    });
    const arnes = await RouterTestingHarness.create('/inicio');
    const html = arnes.routeNativeElement as HTMLElement;
    return { arnes, html };
  }

  const menu = (html: HTMLElement) => html.querySelector<HTMLElement>('#menu-lateral');
  const perfil = (html: HTMLElement) => html.querySelector<HTMLElement>('#panel-del-perfil');
  const botonDelMenu = (html: HTMLElement) => html.querySelector<HTMLButtonElement>('button[aria-controls="menu-lateral"]')!;
  const botonDelAvatar = (html: HTMLElement) => html.querySelector<HTMLButtonElement>('button.shell__avatar')!;

  it('muestra el título de la pantalla que está debajo', async () => {
    const { html } = await crear();

    expect(html.querySelector('.shell__titulo')?.textContent).toContain('Hoy');
    expect(html.querySelector('.hija')).not.toBeNull();
  });

  it('el título cambia al ir a otra pantalla', async () => {
    const { arnes, html } = await crear();

    await arnes.navigateByUrl('/horario');
    arnes.detectChanges();

    expect(html.querySelector('.shell__titulo')?.textContent).toContain('Mi horario');
  });

  it('el avatar lleva las iniciales de quien entró y su nombre como etiqueta accesible', async () => {
    const { html } = await crear();

    expect(botonDelAvatar(html).textContent?.trim()).toBe('CM');
    expect(botonDelAvatar(html).getAttribute('aria-label')).toContain('Cristian Albeiro Morales Urrea');
  });

  describe('el menú de las tres barritas', () => {
    it('empieza cerrado y se abre con el botón de la izquierda', async () => {
      const { arnes, html } = await crear();
      expect(menu(html)).toBeNull();
      expect(botonDelMenu(html).getAttribute('aria-expanded')).toBe('false');

      botonDelMenu(html).click();
      arnes.detectChanges();

      expect(menu(html)).not.toBeNull();
      expect(botonDelMenu(html).getAttribute('aria-expanded')).toBe('true');
    });

    it('lista las secciones de la app', async () => {
      const { arnes, html } = await crear();

      botonDelMenu(html).click();
      arnes.detectChanges();

      const enlaces = Array.from(menu(html)!.querySelectorAll('a')).map((a) => a.textContent?.trim());
      expect(enlaces).toEqual([
        'Hoy',
        'Mi horario',
        'Mis notas',
        'Simulador',
        'Brújula Académica',
        'Mis pendientes',
        'Mi historial y promedios',
        'Mi plan de estudios',
        'Importar mis archivos',
      ]);
    });

    it('marca la sección en la que estás', async () => {
      const { arnes, html } = await crear();

      botonDelMenu(html).click();
      arnes.detectChanges();
      // routerLinkActive se actualiza en un microtask después de dibujar los enlaces.
      await arnes.fixture.whenStable();
      arnes.detectChanges();

      expect(menu(html)!.querySelector('.shell__enlace--activo')?.textContent).toContain('Hoy');
      expect(menu(html)!.querySelector('[aria-current="page"]')).not.toBeNull();
    });

    it('se cierra con Escape y devuelve el foco al botón', async () => {
      const { arnes, html } = await crear();
      botonDelMenu(html).click();
      arnes.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      arnes.detectChanges();

      expect(menu(html)).toBeNull();
    });

    it('se cierra al tocar fuera', async () => {
      const { arnes, html } = await crear();
      botonDelMenu(html).click();
      arnes.detectChanges();

      html.querySelector<HTMLElement>('.shell__fondo')!.click();
      arnes.detectChanges();

      expect(menu(html)).toBeNull();
    });

    it('se cierra solo al ir a una sección', async () => {
      const { arnes, html } = await crear();
      botonDelMenu(html).click();
      arnes.detectChanges();

      await arnes.navigateByUrl('/horario');
      arnes.detectChanges();

      expect(menu(html)).toBeNull();
    });
  });

  describe('el avatar', () => {
    it('despliega tu información personal', async () => {
      const { arnes, html } = await crear();

      botonDelAvatar(html).click();
      arnes.detectChanges();

      expect(perfil(html)).not.toBeNull();
      expect(perfil(html)!.textContent).toContain('Cristian Albeiro Morales Urrea');
      expect(perfil(html)!.textContent).toContain('calbeiromorales@ucundinamarca.edu.co');
      expect(botonDelAvatar(html).getAttribute('aria-expanded')).toBe('true');
    });

    it('trae Mi cuenta, Mis sesiones y cerrar sesión', async () => {
      const { arnes, html } = await crear();

      botonDelAvatar(html).click();
      arnes.detectChanges();

      const enlaces = Array.from(perfil(html)!.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(enlaces).toEqual(['/cuenta/mi-cuenta', '/cuenta/mis-sesiones']);
      expect(perfil(html)!.textContent).toContain('Cerrar sesión');
    });

    it('cerrar sesión usa la confirmación compartida', async () => {
      const { arnes, html } = await crear();
      botonDelAvatar(html).click();
      arnes.detectChanges();

      Array.from(perfil(html)!.querySelectorAll<HTMLButtonElement>('button'))
        .find((b) => b.textContent?.includes('Cerrar sesión'))!
        .click();
      arnes.detectChanges();

      expect(cierre.conConfirmacion).toHaveBeenCalledTimes(1);
      expect(perfil(html)).toBeNull();
    });

    it('abrir uno cierra el otro: nunca hay dos desplegados', async () => {
      const { arnes, html } = await crear();
      botonDelMenu(html).click();
      arnes.detectChanges();

      botonDelAvatar(html).click();
      arnes.detectChanges();

      expect(menu(html)).toBeNull();
      expect(perfil(html)).not.toBeNull();
    });

    it('se cierra con Escape', async () => {
      const { arnes, html } = await crear();
      botonDelAvatar(html).click();
      arnes.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      arnes.detectChanges();

      expect(perfil(html)).toBeNull();
    });
  });
});
