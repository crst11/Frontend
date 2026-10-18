/**
 * Las lecturas de la API cuya última respuesta se guarda en el dispositivo para consultarlas sin conexión
 * (RF12, SCRUM-39): horario, notas, pendientes, el día, la Brújula, el historial, el plan y los avisos.
 *
 * <p>Es una lista de lo que sí, no de lo que no: lo demás (la cuenta, las sesiones, los dispositivos, las
 * importaciones, la guía pública) nunca se guarda, y una ruta nueva no entra aquí por descuido.
 */
const PREFIJOS = [
  '/mis/avance-de-informacion',
  '/mis/avisos',
  '/mis/brujula',
  '/mis/configuracion',
  '/mis/dia',
  '/mis/historial',
  '/mis/horario',
  '/mis/matriculas',
  '/mis/pendientes',
  '/mis/perfil-academico',
  '/mis/preferencias-de-horario',
  '/programas',
];

/** `ruta` es lo que va después de `environment.apiUrl`, sin parámetros. */
export function esLecturaGuardable(ruta: string): boolean {
  return PREFIJOS.some((prefijo) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
}

/**
 * El sondeo de la campana (cada minuto, solo los avisos sin leer) también se guarda, pero no cuenta como «lo que
 * esta pantalla muestra»: sin esto, sin conexión la franja diría la fecha de los avisos y no la de la pantalla.
 */
export function esSondeoDeFondo(urlConParametros: string): boolean {
  return urlConParametros.includes('/mis/avisos') && urlConParametros.includes('soloSinLeer=true');
}
