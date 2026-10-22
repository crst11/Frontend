import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  AsignaturaDeOferta,
  DiaDeClase,
  FranjaPreferida,
  PedidoDePropuestas,
  PropuestaDeHorario,
  PropuestaDeHorarioRepository,
  PropuestasDeHorario,
} from '../../../data-access/propuesta-de-horario.repository';
import { BorradorDeHorario, BorradorDeHorarioStore } from './borrador-de-horario';
import { OfertaDeLaUniversidad } from './oferta/oferta-de-la-universidad';

/** Pausa tras el último cambio de una preferencia antes de guardar el borrador: una escritura por pausa. */
const PAUSA_AL_ESCRIBIR_EN_MS = 500;

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/** Los días que se ofrecen al pedir días libres y con los que se ordena la semana de cada opción. */
const DIAS: readonly { valor: DiaDeClase; texto: string }[] = [
  { valor: 'lunes', texto: 'Lunes' },
  { valor: 'martes', texto: 'Martes' },
  { valor: 'miercoles', texto: 'Miércoles' },
  { valor: 'jueves', texto: 'Jueves' },
  { valor: 'viernes', texto: 'Viernes' },
  { valor: 'sabado', texto: 'Sábado' },
];

const FRANJAS: readonly { valor: FranjaPreferida; texto: string }[] = [
  { valor: 'manana', texto: 'Mañana' },
  { valor: 'tarde', texto: 'Tarde' },
  { valor: 'noche', texto: 'Noche' },
];

interface ClaseDelDia {
  hora: string;
  asignatura: string;
  grupo: string;
}

interface DiaDeLaOpcion {
  texto: string;
  clases: ClaseDelDia[];
}

/** Una propuesta lista para dibujar: sus clases agrupadas por día. Solo reordena lo que dijo el servidor. */
interface OpcionParaMostrar {
  propuesta: PropuestaDeHorario;
  dias: DiaDeLaOpcion[];
}

/**
 * Armar mi horario para matricular (RF13, SCRUM-209 y SCRUM-243): el estudiante sube la oferta de horarios que
 * publica la universidad, elige su semestre y sus materias, dice lo que prefiere, y la pantalla muestra las
 * combinaciones sin choques que propone el servidor. No se escribe nada a mano: la oferta es la única fuente.
 *
 * <p>Aquí no se calcula nada: la oferta y las preferencias se mandan al servidor y se muestra lo que responde,
 * con el puntaje y los motivos que él escribe. Las preferencias se guardan como borrador en este dispositivo,
 * no en el servidor, y se borran al cerrar sesión; la oferta no se guarda en ningún lado.
 */
@Component({
  selector: 'app-plan-schedule',
  imports: [RouterLink, OfertaDeLaUniversidad],
  templateUrl: './plan-schedule.html',
  styleUrl: './plan-schedule.css',
})
export class PlanSchedule {
  private readonly repositorio = inject(PropuestaDeHorarioRepository);
  private readonly borradores = inject(BorradorDeHorarioStore);
  private readonly notificador = inject(NotifierService);

  protected readonly dias = DIAS;
  protected readonly franjas = FRANJAS;

  /** Las materias que la persona eligió de la oferta que subió, con todos sus grupos. Sin ellas no hay qué proponer. */
  protected readonly asignaturas = signal<AsignaturaDeOferta[]>([]);
  protected readonly franja = signal<FranjaPreferida | null>(null);
  protected readonly pocosHuecos = signal(false);
  protected readonly diasLibres = signal<DiaDeClase[]>([]);

  protected readonly resultado = signal<PropuestasDeHorario | null>(null);
  /** Si al pedir las propuestas se había elegido alguna preferencia: sin ninguna, el puntaje no dice nada. */
  protected readonly pidioPreferencias = signal(false);
  protected readonly calculando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly opciones = computed<OpcionParaMostrar[]>(() =>
    (this.resultado()?.propuestas ?? []).map((propuesta) => ({ propuesta, dias: diasDe(propuesta) })),
  );

  private readonly cambios$ = new Subject<void>();

  constructor() {
    this.cambios$
      .pipe(debounceTime(PAUSA_AL_ESCRIBIR_EN_MS), takeUntilDestroyed())
      .subscribe(() => void this.borradores.guardar(this.borrador()));
    void this.borradores.cargar().then((guardado) => {
      if (guardado) {
        this.franja.set(guardado.franja);
        this.pocosHuecos.set(guardado.pocosHuecos);
        this.diasLibres.set(guardado.diasLibres);
      }
    });
  }

  // --- La oferta de la universidad -------------------------------------------------------------------------

  /**
   * Las materias que la persona tiene elegidas de la oferta que subió (SCRUM-243). Cada cambio (otro semestre, una
   * materia desmarcada, otro archivo) reemplaza lo anterior y lo que ya se había propuesto deja de valer. La oferta
   * no se guarda en ningún lado.
   */
  protected usarOferta(materias: AsignaturaDeOferta[]): void {
    this.asignaturas.set(materias);
    this.resultado.set(null);
    this.error.set(null);
  }

  // --- Preferencias ----------------------------------------------------------------------------------------

  protected elegirFranja(franja: FranjaPreferida | null): void {
    this.franja.set(franja);
    this.cambios$.next();
  }

  protected alternarPocosHuecos(): void {
    this.pocosHuecos.update((actual) => !actual);
    this.cambios$.next();
  }

  protected alternarDiaLibre(dia: DiaDeClase): void {
    this.diasLibres.update((actuales) =>
      actuales.includes(dia) ? actuales.filter((d) => d !== dia) : [...actuales, dia],
    );
    this.cambios$.next();
  }

  // --- Proponer --------------------------------------------------------------------------------------------

  protected proponer(): void {
    if (this.calculando()) {
      return;
    }
    this.error.set(null);
    this.calculando.set(true);
    const pedido = this.pedido();
    this.repositorio.proponer(pedido).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta);
        this.pidioPreferencias.set(pideAlgo(pedido));
        this.calculando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.calculando.set(false);
        this.resultado.set(null);
        if (esFalloDelServidor(err)) {
          void this.notificador.problema('No pudimos armar tu horario', SIN_CONEXION);
          this.error.set(SIN_CONEXION);
          return;
        }
        this.error.set(
          err.status === 400
            ? 'Revisa lo que escribiste: las horas van como 08:00 y no puede faltar ningún dato.'
            : (err.error?.detail ?? 'No pudimos armar tu horario. Revisa lo que escribiste.'),
        );
      },
    });
  }

  // --- Interno ---------------------------------------------------------------------------------------------

  private pedido(): PedidoDePropuestas {
    return {
      asignaturas: this.asignaturas(),
      criterio: { franja: this.franja(), pocosHuecos: this.pocosHuecos(), diasLibres: this.diasLibres() },
    };
  }

  /** Solo las preferencias: la oferta es de cada carga y no se guarda. */
  private borrador(): BorradorDeHorario {
    return { asignaturas: [], franja: this.franja(), pocosHuecos: this.pocosHuecos(), diasLibres: this.diasLibres() };
  }
}

function pideAlgo(pedido: PedidoDePropuestas): boolean {
  const { franja, pocosHuecos, diasLibres } = pedido.criterio;
  return franja !== null || pocosHuecos || diasLibres.length > 0;
}

/** Las clases de una propuesta por día, de lunes a sábado y por hora dentro de cada día. */
function diasDe(propuesta: PropuestaDeHorario): DiaDeLaOpcion[] {
  return DIAS.map(({ valor, texto }) => ({
    texto,
    clases: propuesta.elecciones
      .flatMap((eleccion) =>
        eleccion.bloques
          .filter((bloque) => bloque.dia === valor)
          .map((bloque) => ({
            inicio: bloque.inicio,
            clase: {
              hora: `${bloque.inicio} a ${bloque.fin}`,
              asignatura: eleccion.asignatura,
              grupo: eleccion.grupo,
            },
          })),
      )
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((entrada) => entrada.clase),
  })).filter((dia) => dia.clases.length > 0);
}
