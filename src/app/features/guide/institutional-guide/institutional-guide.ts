import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import { CategoriaDeRecurso, GuiaRepository, RecursoInstitucional } from '../../../data-access/guia.repository';

interface Filtros {
  texto: string;
  idCategoria: number | null;
}

interface GrupoDeRecursos {
  categoria: CategoriaDeRecurso;
  recursos: RecursoInstitucional[];
}

type Resultado = { recursos: RecursoInstitucional[] } | { falla: { status?: number } };

/** Espera tras la última tecla antes de buscar, para no llamar al servidor con cada letra. */
const ESPERA_AL_ESCRIBIR_MS = 300;

/**
 * Guía institucional (RF11, SCRUM-19): se consulta sin cuenta. Busca documentos oficiales, propone
 * qué buscar y los muestra agrupados por categoría, cada uno con su enlace a la fuente oficial.
 * La búsqueda la resuelve el backend; aquí solo se capturan los filtros y se muestra el resultado.
 */
@Component({
  selector: 'app-institutional-guide',
  imports: [RouterLink],
  templateUrl: './institutional-guide.html',
  styleUrl: './institutional-guide.css',
})
export class InstitutionalGuide {
  private readonly repositorio = inject(GuiaRepository);
  private readonly notificador = inject(NotifierService);
  private readonly escritura = new Subject<string>();
  private readonly solicitudes = new Subject<Filtros>();

  protected readonly texto = signal('');
  protected readonly filtros = signal<Filtros>({ texto: '', idCategoria: null });
  protected readonly categorias = signal<CategoriaDeRecurso[]>([]);
  protected readonly sugerencias = signal<string[]>([]);
  protected readonly recursos = signal<RecursoInstitucional[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal(false);

  /** Los documentos llegan ordenados por categoría: se agrupan sin cambiar ese orden. */
  protected readonly grupos = computed<GrupoDeRecursos[]>(() => {
    const grupos: GrupoDeRecursos[] = [];
    for (const recurso of this.recursos()) {
      const ultimo = grupos.at(-1);
      if (ultimo?.categoria.id === recurso.categoria.id) {
        ultimo.recursos.push(recurso);
      } else {
        grupos.push({ categoria: recurso.categoria, recursos: [recurso] });
      }
    }
    return grupos;
  });

  constructor() {
    this.solicitudes
      .pipe(
        // switchMap: si llega una búsqueda nueva, la anterior se descarta y no pisa el resultado.
        switchMap((filtros) =>
          this.repositorio.buscar(filtros.texto, filtros.idCategoria).pipe(
            map((recursos): Resultado => ({ recursos })),
            catchError((falla: { status?: number }) => of<Resultado>({ falla })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => this.mostrar(resultado));

    this.escritura
      .pipe(debounceTime(ESPERA_AL_ESCRIBIR_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((texto) => this.buscar({ ...this.filtros(), texto }));

    // Las sugerencias y las categorías son ayudas: si fallan, la guía sigue funcionando sin ellas.
    this.repositorio.sugerencias().subscribe({ next: (s) => this.sugerencias.set(s), error: () => undefined });
    this.repositorio.categorias().subscribe({ next: (c) => this.categorias.set(c), error: () => undefined });
    this.buscar(this.filtros());
  }

  protected escribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.texto.set(texto);
    this.escritura.next(texto);
  }

  protected usarSugerencia(sugerencia: string): void {
    this.texto.set(sugerencia);
    this.buscar({ ...this.filtros(), texto: sugerencia });
  }

  protected limpiar(): void {
    this.texto.set('');
    this.buscar({ ...this.filtros(), texto: '' });
  }

  protected filtrarPorCategoria(idCategoria: number | null): void {
    this.buscar({ ...this.filtros(), idCategoria });
  }

  /** "2026-09-26" → "26 sept. 2026", sin depender de la zona horaria del navegador. */
  protected fecha(iso: string): string {
    const [anio, mes, dia] = iso.split('-').map(Number);
    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private buscar(filtros: Filtros): void {
    this.filtros.set(filtros);
    this.cargando.set(true);
    this.solicitudes.next(filtros);
  }

  private mostrar(resultado: Resultado): void {
    this.cargando.set(false);
    if ('recursos' in resultado) {
      this.error.set(false);
      this.recursos.set(resultado.recursos);
      return;
    }
    this.error.set(true);
    this.recursos.set([]);
    if (esFalloDelServidor(resultado.falla)) {
      void this.notificador.problema(
        'No pudimos cargar la guía',
        'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.',
      );
    }
  }
}
