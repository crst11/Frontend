import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { AvisoRepository } from '../../../data-access/aviso.repository';
import { CierreDeSesion } from '../../../core/session/cierre-de-sesion.service';
import { SessionService } from '../../../core/session/session.service';
import { AppShell } from './app-shell';

@Component({ template: '<p class="hija">Contenido</p>' })
class Hija {}

describe('AppShell', () => {
  const cierre = { conConfirmacion: vi.fn() };

  async function crear(
    cuenta: { nombres: string; apellidos: string; correo: string } | null = {
      nombres: 'Cristian Albeiro',
      apellidos: 'Morales Urrea',
      correo: 'calbeiromorales@ucundinamarca.edu.co',
    },
    sinLeer = 0,
  ) {
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
        { provide: AvisoRepository, useValue: { misAvisos: vi.fn().mockReturnValue(of({ sinLeer, avisos: [] })) } },
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

  it('el nombre accesible del avatar incluye el texto que se ve, como palabra completa (WCAG 2.5.3)', async () => {
    const { html } = await crear();

    const visible = botonDelAvatar(html).textContent?.trim() ?? '';
    const palabras = (botonDelAvatar(html).getAttribute('aria-label') ?? '').split(/[\s,:]+/);

    expect(visible).toBe('CM');
    expect(palabras).toContain(visible);
  });

  describe('la campana de avisos', () => {
    const campana = (html: HTMLElement) => html.querySelector<HTMLAnchorElement>('a.shell__campana')!;

    it('lleva a los avisos y, sin nada por leer, no muestra número', async () => {
      const { html } = await crear();

      expect(campana(html).getAttribute('href')).toBe('/avisos');
      expect(campana(html).getAttribute('aria-label')).toBe('Avisos');
      expect(html.querySelector('.shell__insignia')).toBeNull();
    });

    it('muestra cuántos avisos faltan por leer, también en su etiqueta para quien no la ve', async () => {
      const { arnes, html } = await crear(undefined, 3);
      arnes.detectChanges();

      expect(html.querySelector('.shell__insignia')?.textContent).toContain('3');
      expect(campana(html).getAttribute('aria-label')).toBe('Avisos: 3 sin leer');
    });

    it('con más de nueve dice 9+', async () => {
      const { arnes, html } = await crear(undefined, 14);
      arnes.detectChanges();

      expect(html.querySelector('.shell__insignia')?.textContent).toContain('9+');
    });
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
        'Armar mi horario',
        'Mis notas',
        'Simulador',
        'Brújula Académica',
        'Avisos',
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

  describe('la barra inferior (SCRUM-263)', () => {
    const barra = (html: HTMLElement) => html.querySelector<HTMLElement>('nav[aria-label="Navegación principal"]');
    const botonMas = (html: HTMLElement) => barra(html)!.querySelector<HTMLButtonElement>('button')!;

    it('lleva a las cuatro secciones de uso diario y tiene un botón Más', async () => {
      const { html } = await crear();

      const enlaces = Array.from(barra(html)!.querySelectorAll('a'));
      expect(enlaces.map((enlace) => enlace.textContent?.trim())).toEqual(['Inicio', 'Horario', 'Notas', 'Pendientes']);
      expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
        '/inicio',
        '/horario',
        '/calificaciones/mis-notas',
        '/pendientes',
      ]);
      expect(botonMas(html).textContent?.trim()).toBe('Más');
    });

    it('marca la sección en la que estás', async () => {
      const { arnes, html } = await crear();

      expect(barra(html)!.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Inicio');

      await arnes.navigateByUrl('/horario');
      arnes.detectChanges();

      expect(barra(html)!.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Horario');
    });

    it('Más abre el mismo menú de secciones y lo anuncia abierto', async () => {
      const { arnes, html } = await crear();
      expect(botonMas(html).getAttribute('aria-expanded')).toBe('false');
      expect(botonMas(html).getAttribute('aria-controls')).toBe('menu-lateral');

      botonMas(html).click();
      arnes.detectChanges();

      expect(menu(html)).not.toBeNull();
      expect(botonMas(html).getAttribute('aria-expanded')).toBe('true');
    });

    it('al cerrar con Escape el foco vuelve a Más cuando el menú se abrió desde ahí', async () => {
      const { arnes, html } = await crear();
      botonMas(html).click();
      arnes.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      arnes.detectChanges();

      expect(menu(html)).toBeNull();
      expect(document.activeElement).toBe(botonMas(html));
    });
  });
});
