import { DOCUMENT, Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Lo poco que se usa de Google Identity Services (https://accounts.google.com/gsi/client). */
interface RespuestaDeGoogle {
  credential: string;
}

interface OpcionesDelBoton {
  type: 'standard';
  theme: 'outline';
  size: 'large';
  text: 'continue_with' | 'signin_with';
  shape: 'rectangular';
  logo_alignment: 'left' | 'center';
  width: number;
  locale: string;
}

export interface GoogleAccountsId {
  initialize(opciones: {
    client_id: string;
    callback: (respuesta: RespuestaDeGoogle) => void;
    auto_select: boolean;
    cancel_on_tap_outside: boolean;
    context: 'signin' | 'use';
  }): void;
  renderButton(contenedor: HTMLElement, opciones: OpcionesDelBoton): void;
}

type VentanaConGoogle = Window & { google?: { accounts: { id: GoogleAccountsId } } };

const SCRIPT_DE_GOOGLE = 'https://accounts.google.com/gsi/client';
const ANCHO_MAXIMO = 400; // Google no dibuja el botón más ancho que esto.

/**
 * API externa de Google para el inicio de sesión (SCRUM-48). Dibuja el botón oficial de Google y
 * entrega el ID token que Google firma cuando la persona elige su cuenta; ese token se manda al
 * backend, que es quien lo valida. La librería de Google se descarga solo cuando hace falta un botón.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly documento = inject(DOCUMENT);
  private carga: Promise<GoogleAccountsId> | null = null;
  private alElegirCuenta: (idToken: string) => void = () => undefined;

  /** Sin client ID configurado no hay botón de Google: la app sigue funcionando con contraseña. */
  readonly disponible = environment.googleClientId !== '';

  async dibujarBoton(
    contenedor: HTMLElement,
    texto: 'continue_with' | 'signin_with',
    alElegirCuenta: (idToken: string) => void,
  ): Promise<void> {
    const google = await this.cargar();
    // Google se inicializa una sola vez; cada pantalla que dibuja un botón decide qué hacer con el token.
    this.alElegirCuenta = alElegirCuenta;
    google.renderButton(contenedor, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: texto,
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.min(contenedor.clientWidth || ANCHO_MAXIMO, ANCHO_MAXIMO),
      locale: 'es',
    });
  }

  private cargar(): Promise<GoogleAccountsId> {
    this.carga ??= this.descargarScript().then((google) => {
      google.initialize({
        client_id: environment.googleClientId,
        callback: (respuesta) => this.alElegirCuenta(respuesta.credential),
        auto_select: false,
        cancel_on_tap_outside: true,
        context: 'signin',
      });
      return google;
    });
    return this.carga;
  }

  private descargarScript(): Promise<GoogleAccountsId> {
    const ventana = this.documento.defaultView as VentanaConGoogle;
    if (ventana.google?.accounts?.id) {
      return Promise.resolve(ventana.google.accounts.id);
    }
    return new Promise((resolver, rechazar) => {
      const script = this.documento.createElement('script');
      script.src = SCRIPT_DE_GOOGLE;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        ventana.google?.accounts?.id
          ? resolver(ventana.google.accounts.id)
          : rechazar(new Error('Google Identity Services no quedó disponible'));
      script.onerror = () => {
        // Si falla (sin internet), el próximo intento vuelve a descargarlo.
        this.carga = null;
        rechazar(new Error('No se pudo descargar Google Identity Services'));
      };
      this.documento.head.appendChild(script);
    });
  }
}
