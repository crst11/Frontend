import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { NotifierService } from '../../../core/feedback/notifier.service';
import { esFalloDelServidor } from '../../../core/feedback/server-failure';
import {
  AsignaturaDeOferta,
  BloqueDeOferta,
  DiaDeClase,
  FranjaPreferida,
  GrupoDeOferta,
  PedidoDePropuestas,
  PropuestaDeHorario,
  PropuestaDeHorarioRepository,
  PropuestasDeHorario,
} from '../../../data-access/propuesta-de-horario.repository';
import { BorradorDeHorario, BorradorDeHorarioStore } from './borrador-de-horario';

/** Pausa tras la última tecla antes de guardar el borrador: una escritura por pausa y no una por letra. */
const PAUSA_AL_ESCRIBIR_EN_MS = 500;

const SIN_CONEXION =
  'No logramos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo en unos minutos.';

/** Los días que se ofrecen al escribir un grupo y al pedir días libres. */
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

/**
 * Los máximos que acepta el servidor. Aquí solo apagan el botón de agregar para no dejar escribir de más; quien
 * decide es el servidor, que además rechaza lo que se pase.
 */
const MAXIMOS = { materias: 10, grupos: 12, bloques: 8 } as const;

const NUEVO_BLOQUE: BloqueDeOferta = { dia: 'lunes', inicio: '08:00', fin: '10:00' };

const nuevoGrupo = (): GrupoDeOferta => ({ codigo: '', bloques: [{ ...NUEVO_BLOQUE }] });
const nuevaAsignatura = (): AsignaturaDeOferta => ({ nombre: '', grupos: [nuevoGrupo()] });

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
 * Armar mi horario para matricular (RF13, SCRUM-209): el estudiante escribe las materias con los grupos y horarios
 * que ve al matricular y lo que prefiere, y la pantalla muestra las combinaciones sin choques que propone el
 * servidor.
 *
 * <p>Aquí no se calcula nada: la oferta y las preferencias se mandan al servidor y se muestra lo que responde,
 * con el puntaje y los motivos que él escribe. Lo escrito se guarda como borrador en este dispositivo, no en el
 * servidor, y se borra al cerrar sesión.
 */
@Component({
  selector: 'app-plan-schedule',
  imports: [RouterLink],
  templateUrl: './plan-schedule.html',
  styleUrl: './plan-schedule.css',
})
export class PlanSchedule {
  private readonly repositorio = inject(PropuestaDeHorarioRepository);
  private readonly borradores = inject(BorradorDeHorarioStore);
  private readonly notificador = inject(NotifierService);

  protected readonly dias = DIAS;
  protected readonly franjas = FRANJAS;
  protected readonly maximos = MAXIMOS;

  protected readonly asignaturas = signal<AsignaturaDeOferta[]>([nuevaAsignatura()]);
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
      if (guardado && guardado.asignaturas.length > 0) {
        this.asignaturas.set(guardado.asignaturas);
        this.franja.set(guardado.franja);
        this.pocosHuecos.set(guardado.pocosHuecos);
        this.diasLibres.set(guardado.diasLibres);
      }
    });
  }

  // --- Materias, grupos y bloques --------------------------------------------------------------------------

  protected agregarAsignatura(): void {
    this.cambiarAsignaturas((lista) => [...lista, nuevaAsignatura()]);
  }

  protected quitarAsignatura(i: number): void {
    this.cambiarAsignaturas((lista) => lista.filter((_, posicion) => posicion !== i));
  }

  protected cambiarNombre(i: number, nombre: string): void {
    this.cambiarAsignatura(i, (asignatura) => ({ ...asignatura, nombre }));
  }

  protected agregarGrupo(i: number): void {
    this.cambiarAsignatura(i, (asignatura) => ({ ...asignatura, grupos: [...asignatura.grupos, nuevoGrupo()] }));
  }

  protected quitarGrupo(i: number, g: number): void {
    this.cambiarAsignatura(i, (asignatura) => ({
      ...asignatura,
      grupos: asignatura.grupos.filter((_, posicion) => posicion !== g),
    }));
  }

  protected cambiarCodigo(i: number, g: number, codigo: string): void {
    this.cambiarGrupo(i, g, (grupo) => ({ ...grupo, codigo }));
  }

  protected agregarBloque(i: number, g: number): void {
    this.cambiarGrupo(i, g, (grupo) => ({ ...grupo, bloques: [...grupo.bloques, { ...NUEVO_BLOQUE }] }));
  }

  protected quitarBloque(i: number, g: number, b: number): void {
    this.cambiarGrupo(i, g, (grupo) => ({ ...grupo, bloques: grupo.bloques.filter((_, posicion) => posicion !== b) }));
  }

  protected cambiarBloque(i: number, g: number, b: number, cambio: Partial<BloqueDeOferta>): void {
    this.cambiarGrupo(i, g, (grupo) => ({
      ...grupo,
      bloques: grupo.bloques.map((bloque, posicion) => (posicion === b ? { ...bloque, ...cambio } : bloque)),
    }));
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
      asignaturas: this.asignaturas().map((asignatura) => ({
        nombre: asignatura.nombre.trim(),
        grupos: asignatura.grupos.map((grupo) => ({ ...grupo, codigo: grupo.codigo.trim() })),
      })),
      criterio: { franja: this.franja(), pocosHuecos: this.pocosHuecos(), diasLibres: this.diasLibres() },
    };
  }

  private borrador(): BorradorDeHorario {
    return {
      asignaturas: this.asignaturas(),
      franja: this.franja(),
      pocosHuecos: this.pocosHuecos(),
      diasLibres: this.diasLibres(),
    };
  }

  private cambiarAsignaturas(cambio: (lista: AsignaturaDeOferta[]) => AsignaturaDeOferta[]): void {
    this.asignaturas.update(cambio);
    this.cambios$.next();
  }

  private cambiarAsignatura(i: number, cambio: (asignatura: AsignaturaDeOferta) => AsignaturaDeOferta): void {
    this.cambiarAsignaturas((lista) =>
      lista.map((asignatura, posicion) => (posicion === i ? cambio(asignatura) : asignatura)),
    );
  }

  private cambiarGrupo(i: number, g: number, cambio: (grupo: GrupoDeOferta) => GrupoDeOferta): void {
    this.cambiarAsignatura(i, (asignatura) => ({
      ...asignatura,
      grupos: asignatura.grupos.map((grupo, posicion) => (posicion === g ? cambio(grupo) : grupo)),
    }));
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
