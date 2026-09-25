import { Injectable } from '@angular/core';
import type { SweetAlertOptions } from 'sweetalert2';

/**
 * Avisos emergentes de la app. Las pantallas piden el aviso por aquí y no conocen SweetAlert2:
 * si un día se cambia la librería, solo se toca este servicio. Los colores y las tipografías
 * salen de los tokens de styles.css (clase app-popup).
 *
 * Regla de uso: lo que la persona puede corregir (un dato mal escrito, un correo repetido) se
 * muestra junto al formulario; el aviso emergente es para confirmaciones, éxitos y fallas del sistema.
 */
@Injectable({ providedIn: 'root' })
export class NotifierService {
  /** Éxito que exige una decisión: el botón lleva a la siguiente acción. */
  async exito(titulo: string, texto: string, textoBoton = 'Continuar'): Promise<void> {
    await this.mostrar({
      icon: 'success',
      title: titulo,
      text: texto,
      confirmButtonText: textoBoton,
      allowOutsideClick: false,
    });
  }

  /** Falla del sistema (sin conexión o error del servidor), no un dato que la persona pueda corregir. */
  async problema(titulo: string, texto: string): Promise<void> {
    await this.mostrar({ icon: 'error', title: titulo, text: texto, confirmButtonText: 'Entendido' });
  }

  /** Pide confirmar una acción; con "Cancelar" enfocado para que un Enter distraído no la ejecute. */
  async confirmar(titulo: string, texto: string, textoBoton: string): Promise<boolean> {
    const resultado = await this.mostrar({
      icon: 'question',
      title: titulo,
      text: texto,
      showCancelButton: true,
      confirmButtonText: textoBoton,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
    });
    return resultado.isConfirmed;
  }

  /** Mensaje breve que se cierra solo y no interrumpe lo que la persona está haciendo. */
  async aviso(mensaje: string): Promise<void> {
    await this.mostrar({
      toast: true,
      position: 'top',
      icon: 'success',
      title: mensaje,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
    });
  }

  /** La librería se descarga la primera vez que se muestra un aviso, no en la carga inicial de la app. */
  private async mostrar(opciones: SweetAlertOptions) {
    const { default: Swal } = await import('sweetalert2');
    return Swal.fire({ heightAuto: false, customClass: { popup: 'app-popup' }, ...opciones });
  }
}
