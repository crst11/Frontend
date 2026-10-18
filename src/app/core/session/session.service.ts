import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, TimeoutError, finalize, firstValueFrom, map, shareReplay, tap, timeout } from 'rxjs';
import { CopiaLocalRepository } from '../../data-access/copia-local.repository';
import { Cuenta, EstudianteRepository, SesionIniciada } from '../../data-access/estudiante.repository';
import { esFalloDelServidor } from '../feedback/server-failure';

/** Dónde se guarda en el dispositivo la cuenta de la última sesión, para poder abrir la app sin conexión. */
const CLAVE_DE_LA_CUENTA = 'cuenta';

/**
 * Cuánto se espera al servidor para recuperar la sesión al abrir la app. Con mala señal una petición puede
 * quedar colgada y la pantalla en blanco; pasado este plazo se trata como falta de conexión.
 */
const PLAZO_PARA_RESTAURAR_EN_MS = 4_000;

/**
 * La sesión vive en memoria: el token de acceso nunca se guarda en localStorage ni sessionStorage, y el
 * refresco viaja en una cookie HttpOnly que el navegador maneja por su cuenta.
 *
 * <p>Para consultar sin conexión (RF12) se guarda en el dispositivo, además, **quién es** la cuenta (nombre y
 * correo, nunca el token) y las lecturas que ya vio. Si al abrir la app no hay red, esa cuenta deja entrar en
 * modo consulta; cuando vuelve la conexión, la primera petición pide el refresco y la sesión se completa sola.
 * Cerrar sesión, o que el servidor dé la sesión por inválida, borra todo eso.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly repositorio = inject(EstudianteRepository);
  private readonly copiaLocal = inject(CopiaLocalRepository);
  private readonly tokenDeAcceso = signal<string | null>(null);
  private readonly cuentaActual = signal<Cuenta | null>(null);
  private readonly enModoConsulta = signal(false);
  private renovacionEnCurso: Observable<string> | null = null;

  readonly cuenta = this.cuentaActual.asReadonly();
  readonly estaAutenticada = computed(() => this.tokenDeAcceso() !== null || this.enModoConsulta());

  token(): string | null {
    return this.tokenDeAcceso();
  }

  iniciar(correo: string, contrasena: string): Observable<Cuenta> {
    return this.repositorio.iniciarSesion(correo, contrasena).pipe(
      tap((sesion) => this.guardar(sesion)),
      map((sesion) => sesion.cuenta),
    );
  }

  /** Entrar con un toque: el ID token de Google lo valida el backend y la sesión queda igual que con contraseña. */
  iniciarConGoogle(idToken: string): Observable<Cuenta> {
    return this.repositorio.iniciarSesionConGoogle(idToken).pipe(
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
    return firstValueFrom(this.renovar().pipe(timeout({ first: PLAZO_PARA_RESTAURAR_EN_MS }))).then(
      () => undefined,
      (error: unknown) => this.alFallarLaRestauracion(error),
    );
  }

  /**
   * Sin red (o con el servidor caído) no se sabe si la sesión sigue viva: no se cierra. Si hay una cuenta
   * guardada de la última vez, se entra en modo consulta con lo que ya se había visto. Si el servidor sí
   * respondió y la rechazó, la sesión ya no existe y se borra todo.
   */
  private async alFallarLaRestauracion(error: unknown): Promise<void> {
    if (error instanceof TimeoutError || esFalloDelServidor(error as { status?: number })) {
      const guardada = await this.copiaLocal.leer(CLAVE_DE_LA_CUENTA);
      if (guardada) {
        this.cuentaActual.set(guardada.valor as Cuenta);
        this.enModoConsulta.set(true);
        return;
      }
    }
    this.limpiar();
  }

  cerrar(): Observable<void> {
    return this.repositorio.cerrarSesion().pipe(finalize(() => this.limpiar()));
  }

  limpiar(): void {
    this.tokenDeAcceso.set(null);
    this.cuentaActual.set(null);
    this.enModoConsulta.set(false);
    // Lo guardado para consultar sin conexión es información personal: no se queda en un dispositivo sin sesión.
    void this.copiaLocal.borrarTodo();
    // Sin esto, una sesión que ya no existe en el servidor se reintentaría en cada carga de la app.
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  }

  private guardar(sesion: SesionIniciada): void {
    this.tokenDeAcceso.set(sesion.tokenDeAcceso);
    this.cuentaActual.set(sesion.cuenta);
    this.enModoConsulta.set(false);
    void this.copiaLocal.guardar(CLAVE_DE_LA_CUENTA, sesion.cuenta, Date.now());
  }
}
