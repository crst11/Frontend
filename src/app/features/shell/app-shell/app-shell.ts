import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AvisosSinLeer } from '../../../core/notifications/avisos-sin-leer.service';
import { CierreDeSesion } from '../../../core/session/cierre-de-sesion.service';
import { SessionService } from '../../../core/session/session.service';

interface Seccion {
  ruta: string;
  texto: string;
}

/** Cada cuánto se vuelve a preguntar cuántos avisos faltan por leer, además de al volver a la pestaña. */
const CADA_CUANTO_SE_REVISAN_LOS_AVISOS_EN_MS = 60_000;

/**
 * El marco de la app una vez dentro (RF02, SCRUM-83): una barra con el menú de las secciones a la
 * izquierda, el título de la pantalla en el centro y tu avatar a la derecha.
 *
 * <p>El menú de tres barritas lleva a cada sección; el avatar con tus iniciales despliega tu información
 * personal y cerrar sesión. Así las pantallas no repiten flechas de volver ni listas de enlaces: cada una
 * solo muestra lo suyo. El título sale de `data.titulo` de la ruta.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly sesion = inject(SessionService);
  private readonly cierre = inject(CierreDeSesion);
  private readonly documento = inject(DOCUMENT);
  private readonly botonDelMenu = viewChild<ElementRef<HTMLButtonElement>>('botonDelMenu');
  private readonly botonDelAvatar = viewChild<ElementRef<HTMLButtonElement>>('botonDelAvatar');

  protected readonly secciones: Seccion[] = [
    { ruta: '/inicio', texto: 'Hoy' },
    { ruta: '/horario', texto: 'Mi horario' },
    { ruta: '/calificaciones/mis-notas', texto: 'Mis notas' },
    { ruta: '/simulador', texto: 'Simulador' },
    { ruta: '/brujula', texto: 'Brújula Académica' },
    { ruta: '/avisos', texto: 'Avisos' },
    { ruta: '/pendientes', texto: 'Mis pendientes' },
    { ruta: '/cuenta/historial', texto: 'Mi historial y promedios' },
    { ruta: '/cuenta/plan-de-estudios', texto: 'Mi plan de estudios' },
    { ruta: '/importar', texto: 'Importar mis archivos' },
  ];

  protected readonly menuAbierto = signal(false);
  protected readonly perfilAbierto = signal(false);

  protected readonly titulo = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.tituloDeLaRuta()),
    ),
    { initialValue: this.tituloDeLaRuta() },
  );

  private readonly avisos = inject(AvisosSinLeer);
  /** La campana: cuántos avisos faltan por leer, escrito en su etiqueta para quien no la ve. */
  protected readonly etiquetaDeAvisos = computed(() => {
    const cantidad = this.avisos.cantidad();
    return cantidad === 0 ? 'Avisos' : `Avisos: ${cantidad} sin leer`;
  });
  protected readonly numeroDeLaCampana = computed(() => (this.avisos.cantidad() > 9 ? '9+' : String(this.avisos.cantidad())));
  protected readonly hayAvisosSinLeer = computed(() => this.avisos.cantidad() > 0);

  protected readonly cuenta = this.sesion.cuenta;
  protected readonly iniciales = computed(() => {
    const cuenta = this.cuenta();
    return cuenta ? ((cuenta.nombres.trim()[0] ?? '') + (cuenta.apellidos.trim()[0] ?? '')).toUpperCase() : '';
  });
  protected readonly nombreCompleto = computed(() => {
    const cuenta = this.cuenta();
    return cuenta ? `${cuenta.nombres} ${cuenta.apellidos}`.trim() : '';
  });

  constructor() {
    // Al ir a otra pantalla, lo que estaba desplegado se cierra solo.
    this.router.events.pipe(filter((evento) => evento instanceof NavigationEnd)).subscribe(() => {
      this.menuAbierto.set(false);
      this.perfilAbierto.set(false);
    });
    this.avisos.refrescar();
    const intervalo = setInterval(() => this.avisos.refrescar(), CADA_CUANTO_SE_REVISAN_LOS_AVISOS_EN_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  }

  @HostListener('document:visibilitychange')
  protected alVolverALaPestana(): void {
    if (this.documento.visibilityState === 'visible') {
      this.avisos.refrescar();
    }
  }

  private tituloDeLaRuta(): string {
    let ruta: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let titulo = '';
    while (ruta) {
      titulo = (ruta.data['titulo'] as string | undefined) ?? titulo;
      ruta = ruta.firstChild;
    }
    return titulo;
  }

  protected alternarMenu(): void {
    this.perfilAbierto.set(false);
    this.menuAbierto.update((abierto) => !abierto);
    if (this.menuAbierto()) {
      setTimeout(() => this.documento.querySelector<HTMLElement>('#menu-lateral a, #menu-lateral button')?.focus());
    }
  }

  protected alternarPerfil(): void {
    this.menuAbierto.set(false);
    this.perfilAbierto.update((abierto) => !abierto);
    if (this.perfilAbierto()) {
      setTimeout(() => this.documento.querySelector<HTMLElement>('#panel-del-perfil a, #panel-del-perfil button')?.focus());
    }
  }

  /** Cierra lo desplegado y devuelve el foco al botón que lo abrió, para quien navega con teclado. */
  @HostListener('document:keydown.escape')
  protected cerrarTodo(): void {
    const eraMenu = this.menuAbierto();
    const eraPerfil = this.perfilAbierto();
    this.menuAbierto.set(false);
    this.perfilAbierto.set(false);
    if (eraMenu) {
      this.botonDelMenu()?.nativeElement.focus();
    } else if (eraPerfil) {
      this.botonDelAvatar()?.nativeElement.focus();
    }
  }

  protected cerrarSesion(): void {
    this.perfilAbierto.set(false);
    void this.cierre.conConfirmacion();
  }
}
