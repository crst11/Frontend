import { MateriaSugerida, SugerenciaDeMatricula } from '../../../../data-access/sugerencia-de-matricula.repository';
import { MateriaLeida } from './lector-de-oferta';
import {
  coincideConElPlan,
  adelantablesPorCreditos,
  creditosDeLasMarcadas,
  cruzarConLaOferta,
} from './sugerencia-en-oferta';

const sugerida = (codigo: string, creditos: number, motivo: MateriaSugerida['motivoDeSugerencia'] = 'siguiente_semestre'): MateriaSugerida => ({
  codigo,
  nombre: `Materia ${codigo}`,
  creditos,
  semestre: 3,
  motivoDeSugerencia: motivo,
  dependeDeUnaEnCurso: false,
});

const leida = (codigo: string): MateriaLeida => ({
  semestre: 3,
  codigo,
  nombre: `Oferta ${codigo}`,
  grupos: [{ codigo: '1', cupos: 10, bloques: [{ dia: 'lunes', inicio: '08:00', fin: '10:00', salon: null }] }],
});

const sugerencia = (materias: MateriaSugerida[], adelantables: MateriaSugerida[] = []): SugerenciaDeMatricula => ({
  semestreActual: 2,
  semestreSugerido: 3,
  materias,
  creditos: materias.reduce((total, m) => total + m.creditos, 0),
  adelantables,
  motivo: null,
});

describe('sugerencia-en-oferta', () => {
  describe('coincideConElPlan', () => {
    it('coincide con el mismo código', () => {
      expect(coincideConElPlan('CAD612021101', 'CAD612021101')).toBe(true);
    });

    it('coincide con una línea de la misma materia: el código de la oferta lleva un guion y la letra', () => {
      expect(coincideConElPlan('CAD612021836-A', 'CAD612021836')).toBe(true);
    });

    it('no confunde un código que solo empieza igual ni un diagnóstico con la materia', () => {
      expect(coincideConElPlan('CAD6120211011', 'CAD612021101')).toBe(false);
      expect(coincideConElPlan('DN-CAI1002020202', 'CAI1002020202')).toBe(false);
    });
  });

  describe('cruzarConLaOferta', () => {
    it('junta cada materia sugerida con sus líneas de la oferta y deja sin líneas las que la oferta no trae', () => {
      const entradas = cruzarConLaOferta(
        sugerencia([sugerida('A', 3), sugerida('B', 4)], [sugerida('C', 2, 'adelantable')]),
        [leida('A'), leida('C')],
      );

      expect(entradas.map((e) => [e.sugerida.codigo, e.lineas.length])).toEqual([
        ['A', 1],
        ['B', 0],
        ['C', 1],
      ]);
    });

    it('trae todas las líneas de una materia con varias (Profundización)', () => {
      const entradas = cruzarConLaOferta(sugerencia([sugerida('P', 10)]), [leida('P-A'), leida('P-B')]);

      expect(entradas[0].lineas.map((l) => l.codigo)).toEqual(['P-A', 'P-B']);
    });
  });

  describe('adelantablesPorCreditos', () => {
    it('agrupa por créditos, de menos a más, solo lo adelantable que la oferta trae', () => {
      const entradas = cruzarConLaOferta(
        sugerencia(
          [sugerida('A', 3)],
          [
            sugerida('F', 3, 'adelantable'),
            sugerida('G', 2, 'adelantable'),
            sugerida('H', 3, 'adelantable'),
            sugerida('X', 2, 'adelantable'),
          ],
        ),
        [leida('A'), leida('F'), leida('G'), leida('H')],
      );

      expect(adelantablesPorCreditos(entradas)).toEqual([
        { creditos: 2, nombres: ['Materia G'] },
        { creditos: 3, nombres: ['Materia F', 'Materia H'] },
      ]);
    });

    it('no devuelve nada si no hay adelantables en la oferta', () => {
      const entradas = cruzarConLaOferta(sugerencia([sugerida('A', 3)], [sugerida('X', 2, 'adelantable')]), [leida('A')]);

      expect(adelantablesPorCreditos(entradas)).toEqual([]);
    });
  });

  describe('creditosDeLasMarcadas', () => {
    const entradas = cruzarConLaOferta(
      sugerencia([sugerida('A', 3), sugerida('P', 10)], [sugerida('C', 2, 'adelantable')]),
      [leida('A'), leida('P-A'), leida('P-B'), leida('C')],
    );

    it('suma los créditos de las materias marcadas', () => {
      expect(creditosDeLasMarcadas(entradas, new Set(['A', 'C']))).toBe(5);
    });

    it('cuenta una materia una sola vez aunque se marquen dos de sus líneas', () => {
      expect(creditosDeLasMarcadas(entradas, new Set(['P-A', 'P-B']))).toBe(10);
    });

    it('es cero sin nada marcado', () => {
      expect(creditosDeLasMarcadas(entradas, new Set())).toBe(0);
    });
  });
});
