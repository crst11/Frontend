import { Injectable } from '@angular/core';
import { CopiaGuardada, CopiaLocalRepository } from '../copia-local.repository';

/**
 * La copia local guardada solo mientras la pestaña está abierta (RF12, SCRUM-39). Es el plan B del adaptador de
 * IndexedDB cuando el navegador no deja usarlo (ventana privada) y lo que usan las pruebas.
 */
@Injectable()
export class CopiaLocalEnMemoriaRepository extends CopiaLocalRepository {
  private readonly copias = new Map<string, CopiaGuardada>();

  override guardar(clave: string, valor: unknown, guardadaEn: number): Promise<void> {
    this.copias.set(clave, { valor, guardadaEn });
    return Promise.resolve();
  }

  override leer(clave: string): Promise<CopiaGuardada | null> {
    return Promise.resolve(this.copias.get(clave) ?? null);
  }

  override borrarTodo(): Promise<void> {
    this.copias.clear();
    return Promise.resolve();
  }
}
