export const environment = {
  production: true,
  nombreAmbiente: 'PRE',
  // Ruta relativa a propósito: CloudFront sirve el frontend y reenvía /api al backend, así que el navegador
  // habla con un solo origen. Ninguna URL queda escrita en el código ni hay CORS de por medio.
  apiUrl: '/api',
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com',
  // SCRUM-92: la llave PUBLICA de Cloudflare Turnstile (como el client ID de Google, no es un secreto). Vacia = la
  // verificacion de bots esta apagada y no se descarga nada. La secreta va solo en el backend (TURNSTILE_SECRETO).
  turnstileLlave: '',
  vapidPublica: '',
};
