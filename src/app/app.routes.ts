import { Routes } from '@angular/router';

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
  { path: '', redirectTo: 'guia', pathMatch: 'full' },
];
