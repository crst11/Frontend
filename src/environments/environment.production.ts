import { ConfiguracionDeEjecucion } from '../app/core/configuracion/configuracion-en-ejecucion';

/**
 * Los valores con los que arranca la app compilada, para cualquier ambiente (dev, pre y prod comparten este archivo:
 * una sola compilación, SCRUM-218). Lo que difiere entre ambientes se lee de `/config.json` al arrancar y manda sobre
 * esto; si ese archivo falta o no hay red, valen estos.
 */
export const environment: ConfiguracionDeEjecucion = {
  // Ruta relativa a propósito: CloudFront (o nginx en Docker) sirve el frontend y reenvía /api al backend, así que el
  // navegador habla con un solo origen. La cookie de refresco es del mismo sitio, no hay CORS y ninguna URL queda
  // escrita en el código.
  apiUrl: '/api',
  // Público: el client ID de Google no es un secreto.
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com',
  // SCRUM-92: la llave PUBLICA de Cloudflare Turnstile (tampoco es un secreto). Vacia = la verificacion de bots esta
  // apagada y no se descarga nada. La secreta va solo en el backend (TURNSTILE_SECRETO).
  turnstileLlave: '',
  // SCRUM-248: la página pública de la universidad donde se consultan los horarios (no pide cuenta; igual en todos los
  // ambientes).
  urlConsultaDeHorarios: 'https://plataforma.ucundinamarca.edu.co/aplicacionesB/condicionales/apl_gen_public.jsp?id=ConsultaHorario',
};
