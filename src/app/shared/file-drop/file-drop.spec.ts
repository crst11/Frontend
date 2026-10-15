import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SoltarArchivo } from './file-drop';

@Component({
  imports: [SoltarArchivo],
  template: `<div class="zona" appSoltarArchivo [desactivado]="desactivado()" (archivoSoltado)="recibidos.push($event)">zona</div>`,
})
class Anfitrion {
  readonly desactivado = signal(false);
  readonly recibidos: File[] = [];
}

describe('SoltarArchivo', () => {
  function crear() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, zona: fixture.nativeElement.querySelector('.zona') as HTMLElement };
  }

  function evento(tipo: string, archivos: File[] = []): Event {
    const e = new Event(tipo, { cancelable: true, bubbles: true });
    Object.defineProperty(e, 'dataTransfer', { value: { files: archivos } });
    return e;
  }

  it('entrega el archivo soltado y quita el resaltado', () => {
    const { fixture, zona } = crear();
    const archivo = new File(['x'], 'tabla.html');

    zona.dispatchEvent(evento('dragover'));
    fixture.detectChanges();
    expect(zona.classList).toContain('import__zona--sobre');

    const soltado = evento('drop', [archivo]);
    zona.dispatchEvent(soltado);
    fixture.detectChanges();

    expect(soltado.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.recibidos).toEqual([archivo]);
    expect(zona.classList).not.toContain('import__zona--sobre');
  });

  it('al salir de la zona sin soltar quita el resaltado', () => {
    const { fixture, zona } = crear();

    zona.dispatchEvent(evento('dragover'));
    zona.dispatchEvent(evento('dragleave'));
    fixture.detectChanges();

    expect(zona.classList).not.toContain('import__zona--sobre');
    expect(fixture.componentInstance.recibidos).toHaveLength(0);
  });

  it('desactivada no recibe archivos', () => {
    const { fixture, zona } = crear();
    fixture.componentInstance.desactivado.set(true);
    fixture.detectChanges();

    zona.dispatchEvent(evento('drop', [new File(['x'], 'a.pdf')]));

    expect(fixture.componentInstance.recibidos).toHaveLength(0);
  });
});
