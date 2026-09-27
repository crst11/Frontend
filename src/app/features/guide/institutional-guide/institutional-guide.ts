import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
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

/** Sin tildes ni mayúsculas, para comparar como lo hace la búsqueda del backend. */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

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
  /** El texto que se ve viene de escribir a mano (no de tocar una sugerencia ni de limpiar el campo). */
  protected readonly escribiendoLibremente = signal(false);
  private readonly resultados = viewChild<ElementRef<HTMLElement>>('resultados');

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

  /**
   * Mientras se escribe a mano, solo se ven las sugerencias que de verdad tienen que ver con lo
   * escrito (así el buscador guía sin tapar el resultado); si no hay ninguna relacionada, no se
   * muestra nada. Al tocar una sugerencia o dejar el campo vacío, se vuelve a ver la lista completa.
   */
  protected readonly sugerenciasMostradas = computed<string[]>(() => {
    const consulta = this.texto().trim();
    if (!consulta || !this.escribiendoLibremente()) {
      return this.sugerencias();
    }
    const consultaNormalizada = normalizar(consulta);
    return this.sugerencias().filter((sugerencia) => normalizar(sugerencia).includes(consultaNormalizada));
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
      .subscribe((texto) => {
        this.buscar({ ...this.filtros(), texto });
        if (texto.trim()) {
          this.irAResultados();
        }
      });

    // Las sugerencias y las categorías son ayudas: si fallan, la guía sigue funcionando sin ellas.
    this.repositorio.sugerencias().subscribe({ next: (s) => this.sugerencias.set(s), error: () => undefined });
    this.repositorio.categorias().subscribe({ next: (c) => this.categorias.set(c), error: () => undefined });
    this.buscar(this.filtros());
  }

  protected escribir(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    this.texto.set(texto);
    this.escribiendoLibremente.set(texto.trim().length > 0);
    this.escritura.next(texto);
  }

  protected usarSugerencia(sugerencia: string): void {
    this.texto.set(sugerencia);
    this.escribiendoLibremente.set(false);
    // Una sugerencia busca en toda la guía: si quedaba un filtro de categoría puesto de antes,
    // combinado con el texto podía no encontrar nada aunque el documento sí existiera.
    this.buscar({ texto: sugerencia, idCategoria: null });
    this.irAResultados();
  }

  protected limpiar(): void {
    this.texto.set('');
    this.escribiendoLibremente.set(false);
    this.buscar({ ...this.filtros(), texto: '' });
  }

  protected filtrarPorCategoria(idCategoria: number | null): void {
    // Categoría y búsqueda por texto son dos formas distintas de mirar la guía: combinarlas podía
    // dejar un filtro de texto de una sugerencia anterior sin ningún documento en la nueva categoría.
    this.texto.set('');
    this.escribiendoLibremente.set(false);
    this.buscar({ texto: '', idCategoria });
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

  /** Sube el resultado buscado hasta arriba de la pantalla, para que quede claro que sí se buscó. */
  private irAResultados(): void {
    this.resultados()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
