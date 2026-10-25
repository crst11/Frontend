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

/** Lo que se podría adelantar con un tope de créditos que sobren: las materias que la oferta trae, de menos a más créditos. */
export interface AdelantablesConCreditos {
  creditos: number;
  nombres: string[];
}

/** Agrupa lo adelantable (solo texto, no se marca) por sus créditos; deja fuera lo que la oferta de este período no trae. */
export function adelantablesPorCreditos(entradas: readonly EntradaSugerida[]): AdelantablesConCreditos[] {
  const grupos = new Map<number, string[]>();
  for (const entrada of entradas) {
    if (entrada.sugerida.motivoDeSugerencia !== 'adelantable' || entrada.lineas.length === 0) {
      continue;
    }
    grupos.set(entrada.sugerida.creditos, [...(grupos.get(entrada.sugerida.creditos) ?? []), entrada.sugerida.nombre]);
  }
  return [...grupos.entries()].sort(([a], [b]) => a - b).map(([creditos, nombres]) => ({ creditos, nombres }));
}

/** Los créditos de las materias que tienen alguna línea marcada; una materia cuenta una sola vez. */
export function creditosDeLasMarcadas(entradas: readonly EntradaSugerida[], marcadas: ReadonlySet<string>): number {
  return entradas
    .filter((e) => e.lineas.some((linea) => marcadas.has(linea.codigo)))
    .reduce((total, e) => total + e.sugerida.creditos, 0);
}
