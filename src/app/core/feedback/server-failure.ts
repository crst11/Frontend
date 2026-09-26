/**
 * Distingue una falla del sistema de un dato que la persona puede corregir: sin conexión con el
 * servidor (estado 0) o error interno (5xx). Los 4xx llevan un mensaje del backend para mostrar en el formulario.
 */
export function esFalloDelServidor(err: { status?: number }): boolean {
  return err.status === 0 || (err.status ?? 0) >= 500;
}

/**
 * El servidor respondió, pero el correo con el código no salió (503 "Correo no enviado"). Su mensaje
 * sí es para la persona: dice qué pasó y qué hacer, así que se muestra tal cual.
 */
export function esCorreoNoEnviado(err: { status?: number; error?: { title?: string } | null }): boolean {
  return err.status === 503 && err.error?.title === 'Correo no enviado';
}
