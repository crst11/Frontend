import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { leerConfiguracion } from './app/core/configuracion/configuracion-en-ejecucion';
import { environment } from './environments/environment';

// La configuración se lee ANTES de arrancar Angular (SCRUM-218): los repositorios, los interceptores y el botón de
// Google la consultan al construirse. Si algo falla al leerla, se arranca con lo que trae la compilación.
leerConfiguracion(environment)
  .then((configuracion) => Object.assign(environment, configuracion))
  .catch(() => undefined)
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => console.error(err));
