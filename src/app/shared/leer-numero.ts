/**
 * Lee un número escrito por una persona, con coma o con punto. Vacío es `null` (no escribió nada) y lo
 * que no es un número es `NaN`; que esté dentro de la escala lo dice el servidor.
 */
export function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN;
}
