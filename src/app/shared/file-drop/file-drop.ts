import { Directive, input, output, signal } from '@angular/core';

/**
 * Deja arrastrar un archivo hasta la zona de carga y soltarlo, como alternativa a tocarla para elegirlo.
 * Entrega el primer archivo soltado; qué hacer con él (y si es del tipo correcto) lo decide la pantalla.
 */
@Directive({
  selector: '[appSoltarArchivo]',
  host: {
    '[class.import__zona--sobre]': 'encima()',
    '(dragenter)': 'sobre($event)',
    '(dragover)': 'sobre($event)',
    '(dragleave)': 'encima.set(false)',
    '(drop)': 'soltar($event)',
  },
})
export class SoltarArchivo {
  readonly desactivado = input(false);
  readonly archivoSoltado = output<File>();

  protected readonly encima = signal(false);

  protected sobre(evento: DragEvent): void {
    if (this.desactivado()) {
      return;
    }
    // Sin esto el navegador abre el archivo en la pestaña en vez de entregarlo.
    evento.preventDefault();
    this.encima.set(true);
  }

  protected soltar(evento: DragEvent): void {
    evento.preventDefault();
    this.encima.set(false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo && !this.desactivado()) {
      this.archivoSoltado.emit(archivo);
    }
  }
}
