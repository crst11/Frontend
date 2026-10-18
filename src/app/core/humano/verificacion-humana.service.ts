import { DOCUMENT, Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Lo poco que se usa de Cloudflare Turnstile (https://challenges.cloudflare.com/turnstile/v0/api.js). */
export interface Turnstile {
  render(
    contenedor: HTMLElement,
    opciones: {
      sitekey: string;
      appearance: 'interaction-only';
      language: string;
      callback: (prueba: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
    },
  ): string;
  reset(id: string): void;
}

type VentanaConTurnstile = Window & { turnstile?: Turnstile };

const SCRIPT_DE_TURNSTILE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const ESPERA_MAXIMA_EN_MS = 10_000;

/**
 * La prueba de que quien usa la app es una persona y no un guion (SCRUM-92, ADR 0007), con Cloudflare
 * Turnstile. Casi siempre es invisible: el widget solo aparece abajo si Cloudflare necesita que la
 * persona toque algo.
 *
 * <p>**Apagada por defecto**: sin `turnstileLlave` en el entorno no se descarga nada ni se agrega
 * nada a las peticiones. Cada prueba vale una sola vez, así que al entregarla se pide la siguiente. Si
 * no se puede conseguir (sin internet, Cloudflare caído, el tiempo se agotó) devuelve `null` y la
 * petición sale igual: es el servidor quien decide qué hace sin prueba.
 */
@Injectable({ providedIn: 'root' })
export class VerificacionHumana {
  private readonly documento = inject(DOCUMENT);
  private carga: Promise<string> | null = null;
  private prueba: string | null = null;
  private avisarQueLlego: (() => void) | null = null;

  /** La llave pública no es un secreto (como el client ID de Google): va en los entornos. */
  readonly disponible = environment.turnstileLlave !== '';

  async obtenerPrueba(): Promise<string | null> {
    if (!this.disponible) {
      return null;
    }
    try {
      const idDelWidget = await (this.carga ??= this.iniciar());
      if (this.prueba === null) {
        await this.esperarLaPrueba();
      }
      const lista = this.prueba;
      this.prueba = null;
      (this.documento.defaultView as VentanaConTurnstile).turnstile?.reset(idDelWidget);
      return lista;
    } catch {
      return null;
    }
  }

  private iniciar(): Promise<string> {
    return this.descargarScript().then((turnstile) => {
      const contenedor = this.documento.createElement('div');
      // Abajo y al centro: si Cloudflare necesita que la persona toque algo, ahí aparece.
      contenedor.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:50';
      this.documento.body.appendChild(contenedor);
      return turnstile.render(contenedor, {
        sitekey: environment.turnstileLlave,
        appearance: 'interaction-only',
        language: 'es',
        callback: (prueba) => {
          this.prueba = prueba;
          this.avisarQueLlego?.();
        },
        'error-callback': () => {
          this.prueba = null;
        },
        'expired-callback': () => {
          this.prueba = null;
        },
      });
    });
  }

  /** Espera a que Cloudflare entregue la prueba, sin quedarse colgado: pasado el tiempo, sigue sin ella. */
  private esperarLaPrueba(): Promise<void> {
    return new Promise((resolver) => {
      const temporizador = setTimeout(() => {
        this.avisarQueLlego = null;
        resolver();
      }, ESPERA_MAXIMA_EN_MS);
      this.avisarQueLlego = () => {
        clearTimeout(temporizador);
        this.avisarQueLlego = null;
        resolver();
      };
    });
  }

  private descargarScript(): Promise<Turnstile> {
    const ventana = this.documento.defaultView as VentanaConTurnstile;
    if (ventana.turnstile) {
      return Promise.resolve(ventana.turnstile);
    }
    return new Promise((resolver, rechazar) => {
      const script = this.documento.createElement('script');
      script.src = SCRIPT_DE_TURNSTILE;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        ventana.turnstile ? resolver(ventana.turnstile) : rechazar(new Error('Turnstile no quedó disponible'));
      script.onerror = () => {
        // Si falla (sin internet), el próximo intento vuelve a descargarlo.
        this.carga = null;
        rechazar(new Error('No se pudo descargar Turnstile'));
      };
      this.documento.head.appendChild(script);
    });
  }
}
