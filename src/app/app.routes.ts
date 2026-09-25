import { Routes } from '@angular/router';
import { guardiaDeSesion } from './core/sesion/guardia-de-sesion';

export const routes: Routes = [
  {
    path: 'guia',
    loadComponent: () => import('./features/guia/categorias/categorias').then((m) => m.Categorias),
  },
  {
    path: 'cuenta/registro',
    loadComponent: () => import('./features/cuenta/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'cuenta/verificacion',
    loadComponent: () => import('./features/cuenta/verificacion/verificacion').then((m) => m.Verificacion),
  },
  {
    path: 'cuenta/entrar',
    loadComponent: () =>
      import('./features/cuenta/inicio-de-sesion/inicio-de-sesion').then((m) => m.InicioDeSesion),
  },
  {
    path: 'cuenta/mi-cuenta',
    canActivate: [guardiaDeSesion],
    loadComponent: () => import('./features/cuenta/mi-cuenta/mi-cuenta').then((m) => m.MiCuenta),
  },
  { path: '', redirectTo: 'guia', pathMatch: 'full' },
];
