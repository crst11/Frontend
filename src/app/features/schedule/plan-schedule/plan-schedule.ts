import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  AsignaturaDeOferta,
  DiaDeClase,
  FranjaPreferida,
  GrupoDeOferta,
  PedidoDePropuestas,
  PropuestaDeHorario,
  PropuestaDeHorarioRepository,
  PropuestasDeHorario,
} from '../../../data-access/propuesta-de-horario.repository';
import {
  ChoqueDelCambio,
  VerificacionDeCambioRepository,
} from '../../../data-access/verificacion-de-cambio.repository';
import {
  SugerenciaDeMatricula,
  SugerenciaDeMatriculaRepository,
} from '../../../data-access/sugerencia-de-matricula.repository';
import { BorradorDeHorario, BorradorDeHorarioStore } from './borrador-de-horario';
import { OfertaDeLaUniversidad } from './oferta/oferta-de-la-universidad';

/** Pausa tras el último cambio de una preferencia antes de guardar el borrador: una escritura por pausa. */
const PAUSA_AL_ESCRIBIR_EN_MS = 500;

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/** Los días con los que se ordena la semana de cada opción y los nombres con que se dicen. */
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
  /** Los días que esta opción deja libres, en palabras («viernes y sábado»); vacío si no deja ninguno. */
  diasLiberados: string;
  /** Si la persona le cambió algún grupo: el puntaje y los motivos eran de la sugerencia original. */
  editada: boolean;
}

/** Un grupo que se probó en lugar del actual, con el texto ya armado para mostrarlo. */
interface CandidatoParaMostrar {
  grupo: string;
  horas: string;
  cabe: boolean;
  choques: string[];
}

/** La materia de una opción cuyo grupo se está cambiando (SCRUM-245), con lo que respondió el servidor. */
interface CambioEnCurso {
  opcion: number;
  asignatura: string;
  cargando: boolean;
  error: string | null;
  candidatos: CandidatoParaMostrar[];
  /** La oferta no trae más grupos de esta materia: no hay nada que probar. */
  sinOtrosGrupos: boolean;
}

const dia = (valor: DiaDeClase): string => (DIAS.find((d) => d.valor === valor)?.texto ?? valor).toLowerCase();
const horasDe = (bloques: { dia: DiaDeClase; inicio: string; fin: string }[]): string =>
  bloques.map((b) => `${dia(b.dia)} de ${b.inicio} a ${b.fin}`).join(', ');
const choqueEnTexto = (c: ChoqueDelCambio): string =>
  `choca con ${c.asignatura} (grupo ${c.grupo}), ${dia(c.dia)} de ${c.inicio} a ${c.fin}`;

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
export class PlanSchedule implements OnInit {
  private readonly repositorio = inject(PropuestaDeHorarioRepository);
  private readonly borradores = inject(BorradorDeHorarioStore);
  private readonly notificador = inject(NotifierService);
  private readonly verificaciones = inject(VerificacionDeCambioRepository);
  private readonly sugerencias = inject(SugerenciaDeMatriculaRepository);
  private readonly destruida = inject(DestroyRef);

  /** Lo que el servidor sugiere matricular (SCRUM-244). Sin ella la pantalla funciona como en SCRUM-243. */
  protected readonly sugerencia = signal<SugerenciaDeMatricula | null>(null);
  /** Por qué no hay sugerencia (sin programa, sin historial, plan terminado): el texto lo dice el servidor. */
  protected readonly avisoDeSugerencia = signal<string | null>(null);

  protected readonly franjas = FRANJAS;

  /** Las materias que la persona eligió de la oferta que subió, con todos sus grupos. Sin ellas no hay qué proponer. */
  protected readonly asignaturas = signal<AsignaturaDeOferta[]>([]);
  protected readonly franja = signal<FranjaPreferida | null>(null);
  protected readonly pocosHuecos = signal(false);
  /** «Quiero tener un día libre» (SCRUM-251): se ofrece una opción por cada día que se puede dejar libre. */
  protected readonly diaLibre = signal(false);

  protected readonly resultado = signal<PropuestasDeHorario | null>(null);
  /** Si al pedir las propuestas se había elegido alguna preferencia: sin ninguna, el puntaje no dice nada. */
  protected readonly pidioPreferencias = signal(false);
  /** Si las propuestas que se ven se pidieron con «quiero un día libre»: solo entonces se dice qué días quedan libres. */
  protected readonly pidioDiaLibre = signal(false);
  protected readonly calculando = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Las opciones a las que la persona les cambió algún grupo (por su posición). */
  protected readonly editadas = signal<ReadonlySet<number>>(new Set());
  /** La materia cuyo grupo se está cambiando, si hay alguna. Solo una a la vez. */
  protected readonly cambio = signal<CambioEnCurso | null>(null);

  protected readonly opciones = computed<OpcionParaMostrar[]>(() =>
    (this.resultado()?.propuestas ?? []).map((propuesta, i) => ({
      propuesta,
      dias: diasDe(propuesta),
      editada: this.editadas().has(i),
      // Backend y Frontend se despliegan por separado: un servidor que todavía no manda el campo no debe tumbar la lista.
      diasLiberados: listaDeDias(propuesta.resumen.diasLiberados ?? []),
    })),
  );

  private readonly cambios$ = new Subject<void>();

  constructor() {
    this.cambios$
      .pipe(debounceTime(PAUSA_AL_ESCRIBIR_EN_MS), takeUntilDestroyed())
      .subscribe(() => void this.borradores.guardar(this.borrador()));
  }

  ngOnInit(): void {
    this.sugerencias
      .consultar()
      .pipe(takeUntilDestroyed(this.destruida))
      .subscribe({
        next: (sugerida) => {
          this.sugerencia.set(sugerida.semestreSugerido === null ? null : sugerida);
          this.avisoDeSugerencia.set(sugerida.semestreSugerido === null ? sugerida.motivo : null);
        },
        // La sugerencia es un extra: si no llega, se arma a mano como siempre.
        error: () => this.avisoDeSugerencia.set(null),
      });
    void this.borradores.cargar().then((guardado) => {
      if (guardado) {
        this.franja.set(guardado.franja);
        this.pocosHuecos.set(guardado.pocosHuecos);
        this.diaLibre.set(guardado.diaLibre);
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
    this.olvidarCambios();
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

  protected alternarDiaLibre(): void {
    this.diaLibre.update((actual) => !actual);
    this.cambios$.next();
  }

  // --- Proponer --------------------------------------------------------------------------------------------

  protected proponer(): void {
    if (this.calculando()) {
      return;
    }
    this.error.set(null);
    this.olvidarCambios();
    this.calculando.set(true);
    const pedido = this.pedido();
    this.repositorio.proponer(pedido).subscribe({
      next: (respuesta) => {
        this.resultado.set(respuesta);
        this.pidioPreferencias.set(pideAlgo(pedido));
        this.pidioDiaLibre.set(pedido.criterio.diaLibre);
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

  // --- Cambiar el grupo de una materia de una opción (SCRUM-245) -------------------------------------------

  /**
   * Abre (o cierra) el panel para probar otros grupos de una materia de una opción. El servidor dice, por cada
   * grupo de la oferta, si cabe en el horario de esa opción o con qué choca; aquí solo se muestra. La app no
   * sabe qué docente dicta cada grupo: la persona elige el grupo del docente que conoce.
   */
  protected alternarCambio(opcion: number, asignatura: string): void {
    const actual = this.cambio();
    if (actual?.opcion === opcion && actual.asignatura === asignatura) {
      this.cambio.set(null);
      return;
    }
    const propuesta = this.resultado()?.propuestas[opcion];
    const eleccion = propuesta?.elecciones.find((e) => e.asignatura === asignatura);
    if (!propuesta || !eleccion) {
      return;
    }
    const candidatos = this.gruposDe(asignatura).filter((g) => g.codigo !== eleccion.grupo);
    const base = { opcion, asignatura, error: null, candidatos: [] };
    if (candidatos.length === 0) {
      this.cambio.set({ ...base, cargando: false, sinOtrosGrupos: true });
      return;
    }
    this.cambio.set({ ...base, cargando: true, sinOtrosGrupos: false });
    const horario = propuesta.elecciones.map((e) => ({ asignatura: e.asignatura, grupo: { codigo: e.grupo, bloques: e.bloques } }));
    this.verificaciones
      .verificar({ horario, asignaturaACambiar: asignatura, candidatos })
      .pipe(takeUntilDestroyed(this.destruida))
      .subscribe({
        next: (respuesta) =>
          this.actualizarCambio(opcion, asignatura, {
            cargando: false,
            candidatos: respuesta.candidatos.map((c) => ({
              grupo: c.grupo,
              horas: horasDe(candidatos.find((g) => g.codigo === c.grupo)?.bloques ?? []),
              cabe: c.cabe,
              choques: c.choques.map(choqueEnTexto),
            })),
          }),
        error: (err: HttpErrorResponse) => {
          if (esFalloDelServidor(err)) {
            void this.notificador.problema('No pudimos revisar los grupos', SIN_CONEXION);
          }
          this.actualizarCambio(opcion, asignatura, {
            cargando: false,
            error: esFalloDelServidor(err)
              ? SIN_CONEXION
              : (err.error?.detail ?? 'No pudimos revisar los otros grupos. Intenta de nuevo.'),
          });
        },
      });
  }

  /** Cambia el grupo de la materia en esa opción, solo si el servidor dijo que cabe. */
  protected usarGrupo(opcion: number, asignatura: string, codigo: string): void {
    const respuesta = this.resultado();
    const grupo = this.gruposDe(asignatura).find((g) => g.codigo === codigo);
    const probado = this.cambio()?.candidatos.find((c) => c.grupo === codigo);
    if (!respuesta || !grupo || !probado?.cabe) {
      return;
    }
    const propuestas = respuesta.propuestas.map((propuesta, i) =>
      i !== opcion
        ? propuesta
        : {
            ...propuesta,
            elecciones: propuesta.elecciones.map((e) =>
              e.asignatura === asignatura ? { ...e, grupo: grupo.codigo, bloques: grupo.bloques } : e,
            ),
          },
    );
    this.resultado.set({ ...respuesta, propuestas });
    this.editadas.update((actuales) => new Set(actuales).add(opcion));
    this.cambio.set(null);
  }

  // --- Interno ---------------------------------------------------------------------------------------------

  private gruposDe(asignatura: string): GrupoDeOferta[] {
    return this.asignaturas().find((a) => a.nombre === asignatura)?.grupos ?? [];
  }

  /** Aplica lo que llegó solo si el panel sigue abierto en esa misma materia: una respuesta tardía no pisa otra. */
  private actualizarCambio(opcion: number, asignatura: string, cambios: Partial<CambioEnCurso>): void {
    this.cambio.update((actual) =>
      actual?.opcion === opcion && actual.asignatura === asignatura ? { ...actual, ...cambios } : actual,
    );
  }

  private olvidarCambios(): void {
    this.cambio.set(null);
    this.editadas.set(new Set());
  }

  private pedido(): PedidoDePropuestas {
    return {
      asignaturas: this.asignaturas(),
      criterio: { franja: this.franja(), pocosHuecos: this.pocosHuecos(), diasLibres: [], diaLibre: this.diaLibre() },
    };
  }

  /** Solo las preferencias: la oferta es de cada carga y no se guarda. */
  private borrador(): BorradorDeHorario {
    return { asignaturas: [], franja: this.franja(), pocosHuecos: this.pocosHuecos(), diaLibre: this.diaLibre() };
  }
}

function pideAlgo(pedido: PedidoDePropuestas): boolean {
  // `diasLibres` ya no lo manda la pantalla (va vacío): lo que cuenta es `diaLibre`.
  const { franja, pocosHuecos, diaLibre } = pedido.criterio;
  return franja !== null || pocosHuecos || diaLibre;
}

/** «viernes», «viernes y sábado» o «martes, jueves y sábado», con los nombres de la pantalla. */
function listaDeDias(dias: DiaDeClase[]): string {
  const nombres = dias.map(dia);
  return nombres.length <= 1 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
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
