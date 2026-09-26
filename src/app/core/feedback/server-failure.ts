/**
 * Distingue una falla del sistema de un dato que la persona puede corregir: sin conexión con el
 * servidor (estado 0) o error interno (5xx). Los 4xx llevan un mensaje del backend para mostrar en el formulario.
 */
export function esFalloDelServidor(err: { status?: number }): boolean {
  return err.status === 0 || (err.status ?? 0) >= 500;
}
