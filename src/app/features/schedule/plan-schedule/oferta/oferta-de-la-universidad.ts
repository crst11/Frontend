import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { AsignaturaDeOferta } from '../../../../data-access/propuesta-de-horario.repository';
import {
  MotivoDeSugerencia,
  SugerenciaDeMatricula,
} from '../../../../data-access/sugerencia-de-matricula.repository';
import { SoltarArchivo } from '../../../../shared/file-drop/file-drop';
import { leerArchivoDeOferta, leerCarpetaDeOferta, leerOfertaPegada } from './archivo-de-oferta';
import { MateriaLeida, OfertaLeida, OfertaNoLegible, aAsignaturaDeOferta } from './lector-de-oferta';
import {
  EntradaSugerida,
  creditosDeLasMarcadas,
  cruzarConLaOferta,
  marcadasPorDefecto,
} from './sugerencia-en-oferta';

/** Cómo se le dice a la persona por qué se le sugiere cada materia. */
const TEXTO_DEL_MOTIVO: Record<MotivoDeSugerencia, string> = {
  siguiente_semestre: 'Te toca',
  pendiente: 'Pendiente',
  a_repetir: 'Por repetir',
  adelantable: 'Adelantable',
};

/** Lo que acepta el servidor al armar un horario; aquí solo oculta lo que sigue: quien decide es el servidor. */
const MAXIMO_DE_MATERIAS = 10;

const COMO_COPIAR_LA_TABLA =
  'Lo que pegaste no trae la tabla con su formato. Selecciona la tabla en la página de la universidad, cópiala ' +
  'con Ctrl+C y pégala aquí con Ctrl+V; o sube el archivo de la página guardada.';
const NO_SE_PUDO_LEER =
  'No pudimos leer ese archivo. Revisa que sea la página guardada de «Consultar Horarios» (el archivo ' +
  'pub_rep_val.html).';

/** Lo más largo del detalle técnico que se muestra: lo justo para identificar el fallo. */
const MAXIMO_DEL_DETALLE = 160;

interface PasoDeLaGuia {
  texto: string;
  resaltado: string;
  /** Si el texto resaltado lleva a la página de la universidad. */
  conEnlace?: boolean;
}

function detalleTecnico(fallo: unknown): string {
  // Se lee `name` y `message` de cualquier objeto: una DOMException del navegador no siempre es un `Error` para JS.
  const { name, message } = (typeof fallo === 'object' && fallo !== null ? fallo : {}) as Record<string, unknown>;
  const detalle = typeof name === 'string' ? `${name}: ${typeof message === 'string' ? message : ''}` : 'error desconocido';
  return `(Detalle técnico: ${detalle.slice(0, MAXIMO_DEL_DETALLE)})`;
}

/**
 * Subir la oferta de horarios de la universidad (SCRUM-243 y SCRUM-247): la persona sube la página que guardó de
 * «Consultar Horarios» (o pega la tabla), elige su semestre y las materias que quiere, y cada cambio le entrega a
 * la pantalla de armar el horario las materias elegidas, listas para pedirle propuestas al servidor.
 *
 * <p>Todo ocurre en el navegador: el archivo no se envía a ningún lado y no se guarda. Lo que trae se muestra
 * siempre como texto; su HTML nunca se inserta en la página. La carga se ve y se usa como las demás importaciones
 * de la app: misma zona (se toca o se arrastra), misma guía y mismos estilos.
 */
@Component({
  selector: 'app-oferta-de-la-universidad',
  imports: [NgTemplateOutlet, SoltarArchivo],
  templateUrl: './oferta-de-la-universidad.html',
  styleUrls: ['../../../importing/import-report/import-report.css', './oferta-de-la-universidad.css'],
})
export class OfertaDeLaUniversidad {
  /** El semestre con que arranca la lista, si está en la oferta; sin él, el primero. */
  readonly semestreInicial = input<number | null>(null);
  /**
   * Lo que el servidor sugiere matricular (SCRUM-244). Con un semestre sugerido, la lista arranca con esas materias
   * marcadas y la persona puede pasar a elegir a mano; sin él, todo funciona como siempre.
   */
  readonly sugerencia = input<SugerenciaDeMatricula | null>(null);
  /**
   * Las materias que la persona tiene marcadas, con todos sus grupos y la hora de fin ya normalizada. Vacío mientras
   * no haya oferta cargada o si se pasa del máximo de materias que acepta el servidor.
   */
  readonly materiasElegidas = output<AsignaturaDeOferta[]>();

  protected readonly pasos: PasoDeLaGuia[] = [
    { texto: 'Entra a la plataforma de la universidad y abre', resaltado: 'Consultar Horarios', conEnlace: true },
    { texto: 'Elige tu sede y tu pensum y pulsa el botón de', resaltado: 'buscar' },
    { texto: 'Guarda la página con', resaltado: 'Ctrl+S' },
    {
      texto: 'Abre la carpeta que se crea junto al archivo guardado (termina en «_files») y sube',
      resaltado: 'pub_rep_val.html',
    },
    { texto: 'Si no lo encuentras, elige con el botón de abajo la carpeta completa que termina en', resaltado: '_files' },
  ];

  protected readonly urlConsultaDeHorarios = environment.urlConsultaDeHorarios;
  protected readonly maximoDeMaterias = MAXIMO_DE_MATERIAS;
  protected readonly guiaAbierta = signal(false);
  protected readonly pegadoAbierto = signal(false);
  protected readonly oferta = signal<OfertaLeida | null>(null);
  protected readonly semestre = signal<number | null>(null);
  protected readonly leyendo = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly desmarcadas = signal<ReadonlySet<string>>(new Set());
  /** Las líneas que la persona dejó marcadas en la sugerencia; nulo mientras no toque nada (rigen las de por defecto). */
  private readonly marcadasPorLaPersona = signal<ReadonlySet<string> | null>(null);
  /** La persona pidió elegir a mano en lugar de seguir la sugerencia. */
  protected readonly eligeAMano = signal(false);
  private cerrada = false;
  private primeraEjecucion = true;

  protected readonly semestres = computed(() =>
    [...new Set((this.oferta()?.materias ?? []).map((m) => m.semestre))].sort((a, b) => a - b),
  );
  protected readonly materiasDelSemestre = computed<MateriaLeida[]>(() =>
    (this.oferta()?.materias ?? []).filter((m) => m.semestre === this.semestre()),
  );
  protected readonly elegidas = computed(() =>
    this.materiasDelSemestre().filter((m) => !this.desmarcadas().has(m.codigo)),
  );

  /** La sugerencia sirve solo si trae un semestre: sin plan o sin historial el servidor no sugiere nada. */
  protected readonly haySugerencia = computed(() => this.sugerencia()?.semestreSugerido != null);
  protected readonly siguiendoLaSugerencia = computed(() => this.haySugerencia() && !this.eligeAMano());
  protected readonly entradas = computed<EntradaSugerida[]>(() => {
    const sugerencia = this.sugerencia();
    const oferta = this.oferta();
    return sugerencia && oferta ? cruzarConLaOferta(sugerencia, oferta.materias) : [];
  });
  protected readonly marcadas = computed<ReadonlySet<string>>(
    () => this.marcadasPorLaPersona() ?? marcadasPorDefecto(this.entradas()),
  );
  protected readonly entradasSugeridas = computed(() =>
    this.entradas().filter((e) => e.lineas.length > 0 && e.sugerida.motivoDeSugerencia !== 'adelantable'),
  );
  protected readonly entradasAdelantables = computed(() =>
    this.entradas().filter((e) => e.lineas.length > 0 && e.sugerida.motivoDeSugerencia === 'adelantable'),
  );
  protected readonly sinOferta = computed(() => this.entradas().filter((e) => e.lineas.length === 0));
  protected readonly creditos = computed(() => creditosDeLasMarcadas(this.entradas(), this.marcadas()));

  private readonly lineasMarcadas = computed(() =>
    this.entradas().flatMap((e) => e.lineas.filter((linea) => this.marcadas().has(linea.codigo))),
  );
  private readonly cantidadElegida = computed(() =>
    this.siguiendoLaSugerencia() ? this.lineasMarcadas().length : this.elegidas().length,
  );
  protected readonly pasaDelMaximo = computed(() => this.cantidadElegida() > MAXIMO_DE_MATERIAS);

  constructor() {
    // Una lectura que termina después de salir de la pantalla no debe tocar nada.
    inject(DestroyRef).onDestroy(() => (this.cerrada = true));
    // Cada cambio de la oferta, del semestre o de las casillas le avisa a la pantalla qué materias quedaron. La primera
    // vez (sin oferta todavía) no hay nada que avisar.
    effect(() => {
      const elegidas = this.siguiendoLaSugerencia() ? this.lineasMarcadas() : this.elegidas();
      const materias = this.oferta() && !this.pasaDelMaximo() ? elegidas.map(aAsignaturaDeOferta) : [];
      if (this.primeraEjecucion) {
        this.primeraEjecucion = false;
        return;
      }
      this.materiasElegidas.emit(materias);
    });
  }

  protected alternarGuia(): void {
    this.guiaAbierta.update((abierta) => !abierta);
  }

  protected alternarPegado(): void {
    this.pegadoAbierto.update((abierto) => !abierto);
  }

  protected async subirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (archivo) {
      await this.cargar(() => leerArchivoDeOferta(archivo));
    }
    // Para poder subir otra vez el mismo archivo.
    entrada.value = '';
  }

  /** La carpeta guardada completa (la que termina en «_files»): la tabla se busca adentro, sin que la persona la ubique. */
  protected async subirCarpeta(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    if (archivos.length > 0) {
      await this.cargar(() => leerCarpetaDeOferta(archivos));
    }
    entrada.value = '';
  }

  protected async soltado(archivo: File): Promise<void> {
    await this.cargar(() => leerArchivoDeOferta(archivo));
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

  protected estaMarcada(codigo: string): boolean {
    return this.marcadas().has(codigo);
  }

  /** Marca o desmarca una línea de la sugerencia; desde ese momento mandan las casillas de la persona. */
  protected alternarMarcada(codigo: string): void {
    const nuevas = new Set(this.marcadas());
    if (!nuevas.delete(codigo)) {
      nuevas.add(codigo);
    }
    this.marcadasPorLaPersona.set(nuevas);
  }

  protected alternarModo(): void {
    this.eligeAMano.update((aMano) => !aMano);
  }

  protected textoDelMotivo(motivo: MotivoDeSugerencia): string {
    return TEXTO_DEL_MOTIVO[motivo];
  }

  private async cargar(lectura: () => Promise<OfertaLeida>): Promise<void> {
    this.error.set(null);
    this.leyendo.set(true);
    try {
      const leida = await lectura();
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
    }
  }

  private recibir(leida: OfertaLeida): void {
    this.oferta.set(leida);
    this.desmarcadas.set(new Set());
    this.marcadasPorLaPersona.set(null);
    const semestres = this.semestres();
    const inicial = this.semestreInicial();
    this.semestre.set(inicial !== null && semestres.includes(inicial) ? inicial : (semestres[0] ?? null));
  }

  private fallar(fallo: unknown): void {
    this.oferta.set(null);
    // Un fallo que no es de contenido (el navegador no pudo abrir el archivo, por ejemplo) lleva su detalle técnico:
    // sin él, quien lo reporta y quien lo arregla no tienen cómo saber qué pasó.
    this.error.set(fallo instanceof OfertaNoLegible ? fallo.message : `${NO_SE_PUDO_LEER} ${detalleTecnico(fallo)}`);
  }
}
