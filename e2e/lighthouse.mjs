// Auditoria de Lighthouse (SCRUM-237): rendimiento, accesibilidad, buenas practicas y SEO de las pantallas publicas, en movil (la emulacion y la
// limitacion de red por defecto de Lighthouse), sobre la compilacion de produccion servida por nginx.
//
// Usa el Chromium de Playwright con un puerto de depuracion abierto, asi no hay que instalar otro Chrome. Compara cada categoria con el minimo de
// lighthouse-presupuesto.json y falla si alguna queda por debajo. Los informes (HTML y JSON) van a resultados/lighthouse/.
//
// Lo que Lighthouse ya no puntua: desde la version 12 no tiene categoria de PWA. El manifiesto, los iconos y el service worker los revisa
// pwa.e2e.ts.
import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const PUERTO = 9222;
const CATEGORIAS = ['performance', 'accessibility', 'best-practices', 'seo'];
// El SEO solo importa donde se quiere que los buscadores lleguen: la entrada y la Guia. Las pantallas de la cuenta las deja fuera robots.txt a
// proposito (Disallow: /cuenta/), y Lighthouse castiga con razon una pagina que dice "no me indexes": ahi no se mide.
const PANTALLAS = [
  { ruta: '/', seo: true },
  { ruta: '/guia', seo: true },
  { ruta: '/cuenta/entrar', seo: false },
  { ruta: '/cuenta/registro', seo: false },
];
const presupuesto = JSON.parse(readFileSync(new URL('./lighthouse-presupuesto.json', import.meta.url), 'utf-8'));

mkdirSync('resultados/lighthouse', { recursive: true });
const navegador = await chromium.launch({ args: [`--remote-debugging-port=${PUERTO}`] });

const filas = [];
let fallos = 0;
try {
  for (const { ruta, seo } of PANTALLAS) {
    const categorias = seo ? CATEGORIAS : CATEGORIAS.filter((c) => c !== 'seo');
    const resultado = await lighthouse(`${BASE}${ruta}`, {
      port: PUERTO,
      output: ['html', 'json'],
      onlyCategories: categorias,
      logLevel: 'error',
    });
    const nombre = ruta === '/' ? 'inicio' : ruta.replace(/^\//, '').replace(/\//g, '-');
    writeFileSync(`resultados/lighthouse/${nombre}.html`, resultado.report[0]);
    writeFileSync(`resultados/lighthouse/${nombre}.json`, resultado.report[1]);

    const puntajes = {};
    for (const categoria of categorias) {
      puntajes[categoria] = Math.round((resultado.lhr.categories[categoria].score ?? 0) * 100);
      const minimo = Math.round((presupuesto[categoria] ?? 0) * 100);
      if (puntajes[categoria] < minimo) {
        fallos++;
        console.error(`FALLO ${ruta}: ${categoria} ${puntajes[categoria]} < ${minimo} (minimo del presupuesto)`);
      }
    }
    filas.push({ ruta, ...puntajes, seo: puntajes.seo ?? 'no aplica' });
  }
} finally {
  await navegador.close();
}

console.log('\nLighthouse (movil), puntajes de 0 a 100:');
console.table(filas);
console.log(`Presupuesto minimo: ${CATEGORIAS.map((c) => `${c} ${Math.round((presupuesto[c] ?? 0) * 100)}`).join(', ')}`);
if (fallos > 0) {
  console.error(`${fallos} categoria(s) por debajo del presupuesto.`);
  process.exit(1);
}
