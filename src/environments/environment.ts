import { ConfiguracionDeEjecucion } from '../app/core/configuracion/configuracion-en-ejecucion';

/** Desarrollo con `ng serve`: el backend corre aparte en el puerto 8080. Las compilaciones usan `environment.production.ts`. */
export const environment: ConfiguracionDeEjecucion = {
  apiUrl: 'http://localhost:8080/api',
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com', // es público: el client ID de Google no es un secreto
  // SCRUM-92: la llave PUBLICA de Cloudflare Turnstile. Vacia = la verificacion de bots esta apagada.
  turnstileLlave: '',
  // SCRUM-248: la página pública de la universidad donde se consultan los horarios (no pide cuenta).
  urlConsultaDeHorarios: 'https://plataforma.ucundinamarca.edu.co/aplicacionesB/condicionales/apl_gen_public.jsp?id=ConsultaHorario',
  // SCRUM-250: las páginas de la universidad donde se entra a la plataforma institucional y al CMAD.
  urlPlataformaInstitucional: 'https://www.ucundinamarca.edu.co/index.php/servicios/plataforma-institucional',
  urlCmad: 'https://www.ucundinamarca.edu.co/index.php/servicios2022/campo-multidimensional-de-aprendizaje',
};
