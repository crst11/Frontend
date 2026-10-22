import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { AsignaturaDeOferta } from '../../../../data-access/propuesta-de-horario.repository';
import { leerArchivoDeOferta, leerOfertaPegada } from './archivo-de-oferta';
import { MateriaLeida, OfertaLeida, OfertaNoLegible, aAsignaturaDeOferta } from './lector-de-oferta';

/** Lo que acepta el servidor al armar un horario; aquí solo apaga el botón: quien decide es el servidor. */
const MAXIMO_DE_MATERIAS = 10;

const COMO_COPIAR_LA_TABLA =
  'Lo que pegaste no trae la tabla con su formato. Selecciona la tabla en la página de la universidad, cópiala ' +
  'con Ctrl+C y pégala aquí con Ctrl+V; o sube el archivo de la página guardada.';
const NO_SE_PUDO_LEER =
  'No pudimos leer ese archivo. Revisa que sea la página guardada de «Consultar Horarios» (el archivo ' +
  'pub_rep_val.html).';

/**
 * Subir la oferta de horarios de la universidad (SCRUM-243): la persona sube la página que guardó de «Consultar
 * Horarios» (o pega la tabla), elige su semestre y las materias que quiere, y el componente las entrega a la
 * pantalla de armar el horario.
 *
 * <p>Todo ocurre en el navegador: el archivo no se envía a ningún lado y no se guarda. Lo que trae se muestra
 * siempre como texto; su HTML nunca se inserta en la página.
 */
@Component({
  selector: 'app-oferta-de-la-universidad',
  templateUrl: './oferta-de-la-universidad.html',
  styleUrl: './oferta-de-la-universidad.css',
})
export class OfertaDeLaUniversidad {
  /** El semestre con que arranca la lista, si está en la oferta; sin él, el primero. */
  readonly semestreInicial = input<number | null>(null);
  /** Las materias que la persona dejó marcadas, ya listas para pedirle propuestas al servidor. */
  readonly materiasElegidas = output<AsignaturaDeOferta[]>();

  protected readonly maximoDeMaterias = MAXIMO_DE_MATERIAS;
  protected readonly oferta = signal<OfertaLeida | null>(null);
  protected readonly semestre = signal<number | null>(null);
  protected readonly leyendo = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly desmarcadas = signal<ReadonlySet<string>>(new Set());
  private cerrada = false;

  protected readonly semestres = computed(() =>
    [...new Set((this.oferta()?.materias ?? []).map((m) => m.semestre))].sort((a, b) => a - b),
  );
  protected readonly materiasDelSemestre = computed<MateriaLeida[]>(() =>
    (this.oferta()?.materias ?? []).filter((m) => m.semestre === this.semestre()),
  );
  protected readonly elegidas = computed(() =>
    this.materiasDelSemestre().filter((m) => !this.desmarcadas().has(m.codigo)),
  );
  protected readonly pasaDelMaximo = computed(() => this.elegidas().length > MAXIMO_DE_MATERIAS);

  constructor() {
    // Una lectura que termina después de salir de la pantalla no debe tocar nada.
    inject(DestroyRef).onDestroy(() => (this.cerrada = true));
  }

  protected async subirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      return;
    }
    this.error.set(null);
    this.leyendo.set(true);
    try {
      const leida = await leerArchivoDeOferta(archivo);
      if (!this.cerrada) {
        this.recibir(leida);
      }
    } catch (fallo) {
      if (!this.cerrada) {
        this.fallar(fallo);
      }
    } finally {
      if (!this.cerrada) {
        this.leyendo.set(false);
      }
      // Para poder subir otra vez el mismo archivo.
      entrada.value = '';
    }
  }

  protected pegar(evento: ClipboardEvent): void {
    evento.preventDefault();
    const html = evento.clipboardData?.getData('text/html') ?? '';
    if (!html.trim()) {
      this.oferta.set(null);
      this.error.set(COMO_COPIAR_LA_TABLA);
      return;
    }
    this.error.set(null);
    try {
      this.recibir(leerOfertaPegada(html));
    } catch (fallo) {
      this.fallar(fallo);
    }
  }

  protected elegirSemestre(valor: string): void {
    this.semestre.set(Number(valor));
    this.desmarcadas.set(new Set());
  }

  protected estaElegida(codigo: string): boolean {
    return !this.desmarcadas().has(codigo);
  }

  protected alternar(codigo: string): void {
    const nuevas = new Set(this.desmarcadas());
    if (!nuevas.delete(codigo)) {
      nuevas.add(codigo);
    }
    this.desmarcadas.set(nuevas);
  }

  protected usar(): void {
    if (this.elegidas().length === 0 || this.pasaDelMaximo()) {
      return;
    }
    this.materiasElegidas.emit(this.elegidas().map(aAsignaturaDeOferta));
  }

  private recibir(leida: OfertaLeida): void {
    this.oferta.set(leida);
    this.desmarcadas.set(new Set());
    const semestres = this.semestres();
    const inicial = this.semestreInicial();
    this.semestre.set(inicial !== null && semestres.includes(inicial) ? inicial : (semestres[0] ?? null));
  }

  private fallar(fallo: unknown): void {
    this.oferta.set(null);
    this.error.set(fallo instanceof OfertaNoLegible ? fallo.message : NO_SE_PUDO_LEER);
  }
}
