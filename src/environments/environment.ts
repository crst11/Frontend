export const environment = {
  production: false,
  nombreAmbiente: 'DEV',
  apiUrl: 'http://localhost:8080/api',
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com', // es público: el client ID de Google no es un secreto
  // SCRUM-92: la llave PUBLICA de Cloudflare Turnstile (como el client ID de Google, no es un secreto). Vacia = la
  // verificacion de bots esta apagada y no se descarga nada. La secreta va solo en el backend (TURNSTILE_SECRETO).
  turnstileLlave: '',
  vapidPublica: '', // la llave VAPID pública también es pública
};
