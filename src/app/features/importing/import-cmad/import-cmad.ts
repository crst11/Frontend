import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { concat, toArray } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { NotifierService } from '../../../core/feedback/notifier.service';
import {
  AcumuladoDeNotas,
  AsignaturaMatriculada,
  CategoriaPorGuardar,
  EvaluacionRepository,
} from '../../../data-access/evaluacion.repository';
import { SoltarArchivo } from '../../../shared/file-drop/file-drop';
import { origenDeLaImportacion } from '../origen-de-la-importacion';
import { extraerHtmlDeMhtml } from './mhtml';
import {
  TablaDelCmad,
  TablaDelCmadNoLegible,
  armarLosCortes,
  CategoriaDelCmad,
  aNumero,
  leerHtmlDelCmad,
} from './lector-del-cmad';

/** Una actividad de la tabla en revisión: el estudiante puede cambiarle el nombre, la nota o dejarla fuera. */
/** El nombre sin tildes, mayúsculas ni espacios de más: «Taller 1» y «taller  1» son la misma actividad. */
function claveDelNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

interface FilaEnRevision {
  incluir: boolean;
  nombre: string;
  ponderacion: number;
  /** Lo que escribió, tal cual: puede traer coma. Vacío es «sin nota». */
  nota: string;
  /** La categoría de Moodle (REA 1…) si el curso las tiene: de ella salen los cortes. */
  categoria?: CategoriaDelCmad;
}

/** Lo que dice la comprobación después de guardar. */
interface Resultado {
  actividades: number;
  conNota: number;
  acumulado: AcumuladoDeNotas | null;
  totalDelCmad: number | null;
}

/** Cuánto pueden diferir el acumulado de CundiApp y el total del CMAD: el CMAD lo muestra con un decimal. */
const TOLERANCIA_DEL_TOTAL = 0.06;

/**
 * Traer las actividades y las notas de una asignatura desde el CMAD (RF03 y RF05, SCRUM-76).
 *
 * <p>El CMAD no genera un reporte de actividades ni de notas, pero su tabla de *Valoraciones* sí se puede
 * guardar como página o copiar y pegar. **La tabla se lee aquí, en el navegador: el archivo nunca se
 * sube** (trae la sesión de Moodle y nombres de otros estudiantes). Lo que se manda al servidor es el árbol
 * de evaluación y las notas, igual que si las hubiera escrito a mano, y el servidor las valida.
 *
 * <p>Son dos pasos, como en las otras importaciones: se muestra lo detectado y solo al confirmar se guarda.
 * Después se compara el acumulado que calcula el servidor con el «Total del curso» del CMAD, que dice si
 * se leyó bien.
 */
@Component({
  selector: 'app-import-cmad',
  imports: [RouterLink, SoltarArchivo],
  templateUrl: './import-cmad.html',
  styleUrls: ['../import-report/import-report.css', './import-cmad.css'],
})
export class ImportCmad {
  private readonly repositorio = inject(EvaluacionRepository);
  private readonly notificador = inject(NotifierService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  /** A dónde vuelve la flecha: la pantalla de la que se llegó (SCRUM-82). */
  protected readonly origen = origenDeLaImportacion(inject(Location));

  protected readonly asignaturas = signal<AsignaturaMatriculada[]>([]);
  protected readonly cargando = signal(true);
  protected readonly idElegido = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly tabla = signal<TablaDelCmad | null>(null);
  protected readonly filas = signal<FilaEnRevision[]>([]);
  protected readonly avisoDeCurso = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly resultado = signal<Resultado | null>(null);
  protected readonly urlCmad = environment.urlCmad;
  protected readonly guiaAbierta = signal(true);
  /** Lo que la asignatura ya tiene guardado, para decir qué cambia al subir de nuevo. */
  private readonly guardadas = signal<{ nombre: string; nota: number | null }[]>([]);

  protected readonly asignatura = computed(() => this.asignaturas().find((a) => a.idMatricula === this.idElegido()) ?? null);
  protected readonly notasInvalidas = computed(() => this.filas().filter((f) => f.incluir && this.notaEscrita(f) === 'invalida'));
  protected readonly seleccionadas = computed(() => this.filas().filter((f) => f.incluir));
  protected readonly sePuedeGuardar = computed(
    () => this.seleccionadas().length > 0 && this.notasInvalidas().length === 0 && !this.guardando(),
  );
  /** Qué cambia respecto a lo que ya está guardado; nulo si la asignatura no tenía actividades. */
  protected readonly comparacion = computed(() => {
    const guardadas = this.guardadas();
    if (guardadas.length === 0) {
      return null;
    }
    const nuevas = this.seleccionadas().map((f) => ({ nombre: f.nombre.trim(), nota: this.notaNumerica(f) }));
    const claves = new Set(nuevas.map((n) => claveDelNombre(n.nombre)));
    const delServidor = new Map(guardadas.map((g) => [claveDelNombre(g.nombre), g]));
    const cambian = nuevas
      .map((n) => ({ nombre: n.nombre, antes: delServidor.get(claveDelNombre(n.nombre))?.nota, ahora: n.nota, existe: delServidor.has(claveDelNombre(n.nombre)) }))
      .filter((n) => n.existe && n.antes !== n.ahora)
      .map((n) => ({ nombre: n.nombre, antes: n.antes ?? null, ahora: n.ahora }));
    const nuevasActividades = nuevas.filter((n) => !delServidor.has(claveDelNombre(n.nombre))).map((n) => n.nombre);
    const seQuitan = guardadas.filter((g) => !claves.has(claveDelNombre(g.nombre)));
    return {
      cambian,
      nuevas: nuevasActividades,
      seQuitan,
      sinCambios: cambian.length === 0 && nuevasActividades.length === 0 && seQuitan.length === 0,
    };
  });

  protected readonly cortes = computed(() => armarLosCortes(this.seleccionadas().map((f) => this.aFila(f))));

  constructor() {
    this.repositorio.misAsignaturas('actual').subscribe({
      next: (asignaturas) => {
        this.asignaturas.set(asignaturas);
        this.cargando.set(false);
        const pedida = Number(this.ruta.snapshot.queryParamMap.get('matricula'));
        this.idElegido.set(asignaturas.find((a) => a.idMatricula === pedida)?.idMatricula ?? asignaturas[0]?.idMatricula ?? null);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No pudimos traer tus asignaturas. Intenta de nuevo en un momento.');
      },
    });
  }

  protected alternarGuia(): void {
    this.guiaAbierta.update((abierta) => !abierta);
  }

  protected elegirAsignatura(evento: Event): void {
    this.idElegido.set(Number((evento.target as HTMLSelectElement).value));
  }

  /** Elegir un archivo con el selector. */
  protected async archivoElegido(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // Se limpia para que elegir el mismo archivo otra vez vuelva a disparar el evento.
    entrada.value = '';
    if (archivo) {
      await this.procesar(archivo);
    }
  }

  /** Soltar un archivo sobre la zona: es lo mismo que elegirlo. */
  protected soltado(archivo: File): Promise<void> {
    return this.procesar(archivo);
  }

  /** La página guardada del CMAD (.html, o .mht si viene del teléfono); todo en el navegador, nada se sube. */
  private async procesar(archivo: File): Promise<void> {
    if (archivo.type.startsWith('image/')) {
      this.tabla.set(null);
      this.guiaAbierta.set(true);
      this.error.set(
        'Las fotos y capturas no se leen: con el texto tan chico se confunden los números, y una nota mal leída es peor que ninguna. Guarda la página del CMAD o copia la tabla; la guía de arriba te dice cómo, en el computador y en el teléfono.',
      );
      return;
    }
    // En el teléfono, Chrome guarda la página como .mht (MHTML): se toma de ahí la parte HTML.
    const contenido = extraerHtmlDeMhtml(await archivo.text());
    this.leer(() => leerHtmlDelCmad(contenido), contenido);
  }

  private leer(lectura: () => TablaDelCmad, original: string): void {
    this.error.set(null);
    try {
      const tabla = lectura();
      this.tabla.set(tabla);
      this.filas.set(tabla.filas.map((f) => ({ incluir: true, nombre: f.nombre, ponderacion: f.ponderacion, nota: this.notaVisible(f.nota), categoria: f.categoria })));
      this.avisoDeCurso.set(this.compararConLaAsignatura(original, tabla));
      this.cargarLoGuardado();
    } catch (error) {
      this.tabla.set(null);
      this.error.set(
        error instanceof TablaDelCmadNoLegible ? error.message : 'No pudimos leer eso. Revisa que sea la tabla de calificaciones del CMAD.',
      );
    }
  }

  /** Si la asignatura ya tenía actividades, se traen para comparar; si no, no hay nada contra qué comparar. */
  private cargarLoGuardado(): void {
    const asignatura = this.asignatura();
    this.guardadas.set([]);
    if (!asignatura?.tieneEstructura) {
      return;
    }
    this.repositorio.estructuraDe(asignatura.idMatricula).subscribe({
      next: (estructura) =>
        this.guardadas.set(
          estructura.categorias.flatMap((c) => c.actividades.map((a) => ({ nombre: a.nombre, nota: a.nota }))),
        ),
      // Sin la comparación igual se puede guardar: es una ayuda, no un requisito.
      error: () => this.guardadas.set([]),
    });
  }

  private notaNumerica(fila: FilaEnRevision): number | null {
    const numero = Number(fila.nota.trim().replace(',', '.'));
    return fila.nota.trim() !== '' && Number.isFinite(numero) ? numero : null;
  }

  /** Si la página dice de qué curso es y no es el elegido, se avisa: es el error más fácil de cometer. */
  private compararConLaAsignatura(original: string, tabla: TablaDelCmad): string | null {
    const asignatura = this.asignatura();
    if (!asignatura || (!tabla.curso && !/\d{4,20}\//.test(original))) {
      return null;
    }
    const delCurso = (tabla.curso ?? original).toUpperCase();
    return delCurso.includes(asignatura.codigoAsignatura.toUpperCase())
      ? null
      : `Esta tabla no parece ser de ${asignatura.nombre}. Si elegiste mal la asignatura, cámbiala antes de guardar.`;
  }

  protected volverAEmpezar(): void {
    this.tabla.set(null);
    this.filas.set([]);
    this.error.set(null);
    this.avisoDeCurso.set(null);
    this.guardadas.set([]);
    this.resultado.set(null);
  }

  protected alternarIncluir(indice: number): void {
    this.filas.update((filas) => filas.map((f, i) => (i === indice ? { ...f, incluir: !f.incluir } : f)));
  }

  protected cambiarNombre(indice: number, evento: Event): void {
    const nombre = (evento.target as HTMLInputElement).value;
    this.filas.update((filas) => filas.map((f, i) => (i === indice ? { ...f, nombre } : f)));
  }

  protected cambiarNota(indice: number, evento: Event): void {
    const nota = (evento.target as HTMLInputElement).value;
    this.filas.update((filas) => filas.map((f, i) => (i === indice ? { ...f, nota } : f)));
  }

  protected notaEscrita(fila: FilaEnRevision): 'sin-nota' | 'valida' | 'invalida' {
    if (fila.nota.trim() === '') {
      return 'sin-nota';
    }
    const valor = aNumero(fila.nota);
    return valor !== null && /^\s*\d+(?:[.,]\d+)?\s*$/.test(fila.nota) && valor >= 0 && valor <= 5 ? 'valida' : 'invalida';
  }

  protected notaVisible(nota: number | null): string {
    return nota === null ? '' : String(nota);
  }

  private aFila(fila: FilaEnRevision) {
    const nota = this.notaEscrita(fila) === 'valida' ? aNumero(fila.nota) : null;
    return { nombre: fila.nombre.trim() || 'Actividad', ponderacion: fila.ponderacion, nota, categoria: fila.categoria };
  }

  protected textoDeLasActividades(cantidad: number): string {
    return cantidad === 1 ? '1 actividad' : `${cantidad} actividades`;
  }

  protected confirmar(): void {
    const asignatura = this.asignatura();
    if (!asignatura || !this.sePuedeGuardar()) {
      return;
    }

    const cortes = this.cortes();
    const estructura: CategoriaPorGuardar[] = cortes.map((corte, i) => ({
      consecutivo: i + 1,
      nombre: corte.nombre,
      porcentaje: corte.porcentaje,
      // El servidor solo distingue la plantilla de lo que armó el estudiante: lo importado, una vez
      // revisado y confirmado, es del estudiante.
      origen: 'estudiante',
      actividades: corte.actividades.map((a, j) => ({
        consecutivo: j + 1,
        nombre: a.nombre,
        porcentaje: a.porcentaje,
        fechaProgramada: null,
        tipo: 'taller',
      })),
    }));
    const notas = cortes.flatMap((corte, i) =>
      corte.actividades.flatMap((a, j) => (a.nota === null ? [] : [{ corte: i + 1, actividad: j + 1, nota: a.nota }])),
    );

    this.guardando.set(true);
    this.repositorio.guardar(asignatura.idMatricula, estructura).subscribe({
      next: () => this.guardarLasNotas(asignatura.idMatricula, notas, estructura),
      error: (err: HttpErrorResponse) => this.fallo('No pudimos guardar las actividades', err),
    });
  }

  private guardarLasNotas(
    idMatricula: number,
    notas: { corte: number; actividad: number; nota: number }[],
    estructura: CategoriaPorGuardar[],
  ): void {
    const actividades = estructura.reduce((total, c) => total + c.actividades.length, 0);
    const totalDelCmad = this.tabla()?.totalDelCurso ?? null;
    if (notas.length === 0) {
      this.guardando.set(false);
      this.resultado.set({ actividades, conNota: 0, acumulado: null, totalDelCmad });
      return;
    }

    // Una por una y en orden: el servidor valida cada nota y la última trae el acumulado completo.
    concat(...notas.map((n) => this.repositorio.registrarNota(idMatricula, n.corte, n.actividad, n.nota)))
      .pipe(toArray())
      .subscribe({
        next: (registradas) => {
          this.guardando.set(false);
          this.resultado.set({
            actividades,
            conNota: registradas.length,
            acumulado: registradas.at(-1)?.acumulado ?? null,
            totalDelCmad,
          });
        },
        error: (err: HttpErrorResponse) => this.fallo('Se guardaron las actividades, pero no todas las notas', err),
      });
  }

  private fallo(titulo: string, err: HttpErrorResponse): void {
    this.guardando.set(false);
    void this.notificador.problema(titulo, err.error?.detail ?? 'Intenta de nuevo en unos minutos.');
  }

  /** Lo que dice la comprobación: el acumulado de CundiApp contra el «Total del curso» del CMAD. */
  protected comprobacion(resultado: Resultado): { coincide: boolean; texto: string } | null {
    if (!resultado.acumulado || resultado.totalDelCmad === null) {
      return null;
    }
    const puntos = resultado.acumulado.puntos;
    const coincide = Math.abs(puntos - resultado.totalDelCmad) <= TOLERANCIA_DEL_TOTAL;
    return coincide
      ? { coincide, texto: `Coincide con el CMAD: llevas ${puntos.toFixed(2)} de 5.0 y el CMAD dice ${resultado.totalDelCmad}.` }
      : {
          coincide,
          texto: `No coincide: CundiApp calcula ${puntos.toFixed(2)} y el CMAD dice ${resultado.totalDelCmad}. Revisa los porcentajes y las notas.`,
        };
  }

  protected verMisNotas(): void {
    const id = this.idElegido();
    void this.router.navigate(['/calificaciones/mis-notas'], id ? { queryParams: { matricula: id } } : {});
  }
}
