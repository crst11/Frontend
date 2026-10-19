import { ConfiguracionDeEjecucion } from '../app/core/configuracion/configuracion-en-ejecucion';

/** Desarrollo con `ng serve`: el backend corre aparte en el puerto 8080. Las compilaciones usan `environment.production.ts`. */
export const environment: ConfiguracionDeEjecucion = {
  apiUrl: 'http://localhost:8080/api',
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com', // es público: el client ID de Google no es un secreto
  // SCRUM-92: la llave PUBLICA de Cloudflare Turnstile. Vacia = la verificacion de bots esta apagada.
  turnstileLlave: '',
};
