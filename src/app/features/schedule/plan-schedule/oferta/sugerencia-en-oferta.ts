import { MateriaSugerida, SugerenciaDeMatricula } from '../../../../data-access/sugerencia-de-matricula.repository';
import { MateriaLeida } from './lector-de-oferta';

/** Una materia que el servidor sugiere, con las líneas de la oferta de la universidad que le corresponden (SCRUM-244). */
export interface EntradaSugerida {
  sugerida: MateriaSugerida;
  /** Vacío si la oferta de este período no trae la materia; con varias (Profundización) la persona elige una. */
  lineas: MateriaLeida[];
}

/**
 * El código de la oferta es el del plan, o el del plan con una línea al final: `CAD612021836-A` es una línea de
 * `CAD612021836`. Un código que solo empieza igual no cuenta.
 */
export function coincideConElPlan(codigoDeOferta: string, codigoDelPlan: string): boolean {
  return codigoDeOferta === codigoDelPlan || codigoDeOferta.startsWith(`${codigoDelPlan}-`);
}

/** Lo sugerido y lo adelantable, cada materia con sus líneas de la oferta, en el orden en que las dio el servidor. */
export function cruzarConLaOferta(sugerencia: SugerenciaDeMatricula, oferta: readonly MateriaLeida[]): EntradaSugerida[] {
  return [...sugerencia.materias, ...sugerencia.adelantables].map((sugerida) => ({
    sugerida,
    lineas: oferta.filter((materia) => coincideConElPlan(materia.codigo, sugerida.codigo)),
  }));
}

/** Una materia que se podría adelantar y por qué se puede: es solo información, no se marca ni entra al horario. */
export interface Adelantable {
  codigo: string;
  nombre: string;
  creditos: number;
  requisito: string;
}

/** Lo que el plan pide para cursarla, dicho para quien ya lo tiene: sin prerrequisitos o cuáles aprobó. */
export function textoDelRequisito(prerrequisitos: readonly string[]): string {
  if (prerrequisitos.length === 0) {
    return 'no tiene prerrequisitos';
  }
  return `ya aprobaste ${prerrequisitos.join(' y ')}`;
}

/** Lo adelantable que la oferta de este período trae, de menos a más créditos y por nombre. */
export function adelantablesDeLaOferta(entradas: readonly EntradaSugerida[]): Adelantable[] {
  return entradas
    .filter((e) => e.sugerida.motivoDeSugerencia === 'adelantable' && e.lineas.length > 0)
    .map((e) => ({
      codigo: e.sugerida.codigo,
      nombre: e.sugerida.nombre,
      creditos: e.sugerida.creditos,
      requisito: textoDelRequisito(e.sugerida.prerrequisitos),
    }))
    .sort((a, b) => a.creditos - b.creditos || a.nombre.localeCompare(b.nombre, 'es'));
}

/** Las que entran en los créditos que sobran. */
export function queCaben(adelantables: readonly Adelantable[], sobran: number): Adelantable[] {
  return adelantables.filter((materia) => materia.creditos <= sobran);
}

/** Los créditos de las materias que tienen alguna línea marcada; una materia cuenta una sola vez. */
export function creditosDeLasMarcadas(entradas: readonly EntradaSugerida[], marcadas: ReadonlySet<string>): number {
  return entradas
    .filter((e) => e.lineas.some((linea) => marcadas.has(linea.codigo)))
    .reduce((total, e) => total + e.sugerida.creditos, 0);
}
