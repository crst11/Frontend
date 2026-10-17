import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

/**
 * Lo que la aplicación necesita saber del navegador para ofrecer los avisos al dispositivo (RF10,
 * SCRUM-37): si es un iPhone o iPad, si la aplicación está instalada y qué permiso de notificaciones hay.
 *
 * <p>Va aparte para que las pruebas lo reemplacen: no hay otra forma de probar «iPhone sin instalar»
 * desde un navegador de escritorio.
 */
@Injectable({ providedIn: 'root' })
export class EntornoDelNavegador {
  private readonly ventana = inject(DOCUMENT).defaultView;

  /** iPhone, iPod o iPad. Un iPad reciente se presenta como Mac, y se distingue por la pantalla táctil. */
  esIos(): boolean {
    const navegador = this.ventana?.navigator;
    if (!navegador) {
      return false;
    }
    return /iPhone|iPad|iPod/.test(navegador.userAgent) || (/Macintosh/.test(navegador.userAgent) && navegador.maxTouchPoints > 1);
  }

  /**
   * Abierta desde el ícono de la pantalla de inicio y no desde una pestaña. En iOS los avisos solo funcionan
   * así: Safari no los entrega a una página abierta en una pestaña.
   */
  estaInstalada(): boolean {
    const navegador = this.ventana?.navigator as (Navigator & { standalone?: boolean }) | undefined;
    return navegador?.standalone === true || (this.ventana?.matchMedia?.('(display-mode: standalone)').matches ?? false);
  }

  permisoDeNotificaciones(): NotificationPermission | 'no_soportado' {
    return this.ventana && 'Notification' in this.ventana ? this.ventana.Notification.permission : 'no_soportado';
  }
}
