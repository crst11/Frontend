import { Injectable } from '@angular/core';
import { CopiaGuardada, CopiaLocalRepository } from '../copia-local.repository';
import { CopiaLocalEnMemoriaRepository } from '../memoria/copia-local-en-memoria.repository';

const NOMBRE_DE_LA_BASE = 'cundiapp-copia';
const VERSION_DE_LA_BASE = 1;
const ALMACEN = 'lecturas';

interface Registro extends CopiaGuardada {
  clave: string;
}

/**
 * La copia local en IndexedDB (RF12, SCRUM-39): un registro por lectura, con la clave que arma quien guarda
 * (el estudiante y la dirección pedida), el cuerpo de la respuesta y cuándo se guardó.
 *
 * <p>Si el navegador no ofrece IndexedDB o falla al abrirlo (ventana privada, almacenamiento bloqueado), se
 * pasa a memoria y se sigue: la copia es una ayuda para consultar sin conexión, nunca una condición para que
 * la aplicación funcione. Por eso ningún método lanza.
 */
@Injectable()
export class CopiaLocalIndexedDbRepository extends CopiaLocalRepository {
  private readonly respaldoEnMemoria = new CopiaLocalEnMemoriaRepository();
  private base: Promise<IDBDatabase | null> | null = null;

  override async guardar(clave: string, valor: unknown, guardadaEn: number): Promise<void> {
    const registro: Registro = { clave, valor, guardadaEn };
    const base = await this.abrir();
    if (!base) {
      return this.respaldoEnMemoria.guardar(clave, valor, guardadaEn);
    }
    try {
      await this.pedir(base.transaction(ALMACEN, 'readwrite').objectStore(ALMACEN).put(registro));
    } catch {
      // Sin espacio o un valor que no se puede clonar: la copia de esta lectura se pierde, nada más.
      await this.respaldoEnMemoria.guardar(clave, valor, guardadaEn);
    }
  }

  override async leer(clave: string): Promise<CopiaGuardada | null> {
    const base = await this.abrir();
    if (!base) {
      return this.respaldoEnMemoria.leer(clave);
    }
    try {
      const registro = await this.pedir<Registro | undefined>(base.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(clave));
      return registro ? { valor: registro.valor, guardadaEn: registro.guardadaEn } : this.respaldoEnMemoria.leer(clave);
    } catch {
      return this.respaldoEnMemoria.leer(clave);
    }
  }

  override async borrarTodo(): Promise<void> {
    await this.respaldoEnMemoria.borrarTodo();
    const base = await this.abrir();
    if (!base) {
      return;
    }
    try {
      await this.pedir(base.transaction(ALMACEN, 'readwrite').objectStore(ALMACEN).clear());
    } catch {
      // Si no se pudo borrar no hay nada más que hacer desde aquí; la sesión ya se cerró.
    }
  }

  private abrir(): Promise<IDBDatabase | null> {
    this.base ??= new Promise((resolver) => {
      if (typeof indexedDB === 'undefined') {
        resolver(null);
        return;
      }
      try {
        const apertura = indexedDB.open(NOMBRE_DE_LA_BASE, VERSION_DE_LA_BASE);
        apertura.onupgradeneeded = () => apertura.result.createObjectStore(ALMACEN, { keyPath: 'clave' });
        apertura.onsuccess = () => resolver(apertura.result);
        apertura.onerror = () => resolver(null);
        apertura.onblocked = () => resolver(null);
      } catch {
        resolver(null);
      }
    });
    return this.base;
  }

  private pedir<T>(peticion: IDBRequest<T>): Promise<T> {
    return new Promise((resolver, rechazar) => {
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => rechazar(peticion.error);
    });
  }
}
