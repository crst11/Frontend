export const environment = {
  production: true,
  nombreAmbiente: 'DEV',
  // Ruta relativa a propósito: en Docker Compose y en AWS el navegador entra por un solo origen
  // (nginx o CloudFront) que reenvía /api al backend. Así la cookie de refresco es del mismo sitio,
  // no hay CORS de por medio y ninguna URL queda escrita en el código.
  apiUrl: '/api',
  googleClientId: '318897570455-r0bbnl9up9fg0ah0bl7fh3m95cim01p7.apps.googleusercontent.com',
  vapidPublica: '',
};
