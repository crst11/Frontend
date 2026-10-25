import { MateriaSugerida, SugerenciaDeMatricula } from '../../../../data-access/sugerencia-de-matricula.repository';
import { MateriaLeida } from './lector-de-oferta';
import {
  adelantablesDeLaOferta,
  coincideConElPlan,
  creditosDeLasMarcadas,
  cruzarConLaOferta,
  queCaben,
  textoDelRequisito,
} from './sugerencia-en-oferta';

const sugerida = (
  codigo: string,
  creditos: number,
  motivo: MateriaSugerida['motivoDeSugerencia'] = 'siguiente_semestre',
  prerrequisitos: string[] = [],
): MateriaSugerida => ({
  codigo,
  nombre: `Materia ${codigo}`,
  creditos,
  semestre: 3,
  motivoDeSugerencia: motivo,
  dependeDeUnaEnCurso: false,
  prerrequisitos,
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
  creditosDelSemestre: 17,
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

  describe('textoDelRequisito', () => {
    it('dice que no pide prerrequisitos', () => {
      expect(textoDelRequisito([])).toBe('no tiene prerrequisitos');
    });

    it('nombra lo que ya se aprobó', () => {
      expect(textoDelRequisito(['Cálculo I'])).toBe('ya aprobaste Cálculo I');
      expect(textoDelRequisito(['Cálculo I', 'Física I'])).toBe('ya aprobaste Cálculo I y Física I');
    });
  });

  describe('adelantablesDeLaOferta', () => {
    const entradas = cruzarConLaOferta(
      sugerencia(
        [sugerida('A', 3)],
        [
          sugerida('F', 3, 'adelantable', ['Materia A']),
          sugerida('G', 2, 'adelantable'),
          sugerida('H', 3, 'adelantable'),
          sugerida('X', 2, 'adelantable'),
        ],
      ),
      [leida('A'), leida('F'), leida('G'), leida('H')],
    );

    it('trae solo lo adelantable que la oferta trae, de menos a más créditos, con su requisito', () => {
      expect(adelantablesDeLaOferta(entradas)).toEqual([
        { codigo: 'G', nombre: 'Materia G', creditos: 2, requisito: 'no tiene prerrequisitos' },
        { codigo: 'F', nombre: 'Materia F', creditos: 3, requisito: 'ya aprobaste Materia A' },
        { codigo: 'H', nombre: 'Materia H', creditos: 3, requisito: 'no tiene prerrequisitos' },
      ]);
    });

    it('no devuelve nada si la oferta no trae ninguna', () => {
      const sin = cruzarConLaOferta(sugerencia([sugerida('A', 3)], [sugerida('X', 2, 'adelantable')]), [leida('A')]);

      expect(adelantablesDeLaOferta(sin)).toEqual([]);
    });

    it('queCaben deja las que entran en los créditos que sobran', () => {
      expect(queCaben(adelantablesDeLaOferta(entradas), 2).map((m) => m.codigo)).toEqual(['G']);
      expect(queCaben(adelantablesDeLaOferta(entradas), 3).map((m) => m.codigo)).toEqual(['G', 'F', 'H']);
      expect(queCaben(adelantablesDeLaOferta(entradas), 1)).toEqual([]);
      expect(queCaben(adelantablesDeLaOferta(entradas), 0)).toEqual([]);
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
