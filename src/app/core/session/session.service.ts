import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, finalize, firstValueFrom, map, shareReplay, tap } from 'rxjs';
import { Cuenta, EstudianteRepository, SesionIniciada } from '../../data-access/estudiante.repository';

/**
 * La sesión vive solo en memoria: el token de acceso nunca se guarda en localStorage ni
 * sessionStorage, así que cerrar sesión (o la pestaña) no deja nada en el dispositivo.
 * El refresco viaja en una cookie HttpOnly que el navegador maneja por su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly tokenDeAcceso = signal<string | null>(null);
  private readonly cuentaActual = signal<Cuenta | null>(null);
  private renovacionEnCurso: Observable<string> | null = null;

  readonly cuenta = this.cuentaActual.asReadonly();
  readonly estaAutenticada = computed(() => this.tokenDeAcceso() !== null);

  token(): string | null {
    return this.tokenDeAcceso();
  }

  iniciar(correo: string, contrasena: string): Observable<Cuenta> {
    return this.repositorio.iniciarSesion(correo, contrasena).pipe(
      tap((sesion) => this.guardar(sesion)),
      map((sesion) => sesion.cuenta),
    );
  }

  /** Varias peticiones que fallan a la vez comparten un solo refresco. */
  renovar(): Observable<string> {
    this.renovacionEnCurso ??= this.repositorio.renovarSesion().pipe(
      tap((sesion) => this.guardar(sesion)),
      map((sesion) => sesion.tokenDeAcceso),
      finalize(() => (this.renovacionEnCurso = null)),
      shareReplay(1),
    );
    return this.renovacionEnCurso;
  }

  /**
   * Al abrir la aplicación intenta recuperar la sesión con la cookie de refresco. Si no hay señal
   * de una sesión previa (la cookie XSRF-TOKEN solo existe tras iniciar sesión), no molesta al backend.
   */
  restaurar(): Promise<void> {
    if (!document.cookie.split('; ').some((c) => c.startsWith('XSRF-TOKEN='))) {
      return Promise.resolve();
    }
    return firstValueFrom(this.renovar()).then(
      () => undefined,
      () => this.limpiar(),
    );
  }

  cerrar(): Observable<void> {
    return this.repositorio.cerrarSesion().pipe(finalize(() => this.limpiar()));
  }

  limpiar(): void {
    this.tokenDeAcceso.set(null);
    this.cuentaActual.set(null);
  }

  private guardar(sesion: SesionIniciada): void {
    this.tokenDeAcceso.set(sesion.tokenDeAcceso);
    this.cuentaActual.set(sesion.cuenta);
  }
}
