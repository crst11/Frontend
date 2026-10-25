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

/** Arranca marcado lo sugerido que tiene una sola línea; lo adelantable y lo que pide elegir línea, no. */
export function marcadasPorDefecto(entradas: readonly EntradaSugerida[]): Set<string> {
  return new Set(
    entradas
      .filter((e) => e.sugerida.motivoDeSugerencia !== 'adelantable' && e.lineas.length === 1)
      .map((e) => e.lineas[0].codigo),
  );
}

/** Los créditos de las materias que tienen alguna línea marcada; una materia cuenta una sola vez. */
export function creditosDeLasMarcadas(entradas: readonly EntradaSugerida[], marcadas: ReadonlySet<string>): number {
  return entradas
    .filter((e) => e.lineas.some((linea) => marcadas.has(linea.codigo)))
    .reduce((total, e) => total + e.sugerida.creditos, 0);
}
