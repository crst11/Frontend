import { defineConfig } from 'vitest/config';

// Solo para `npm run test:cobertura` (SCRUM-255): medir la cobertura instrumenta el código y hace más lenta cada
// prueba, así que las que pasan en segundos sin medir se acercan a los 5 s por defecto. Las pruebas normales
// (`npm test`) no usan este archivo.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
