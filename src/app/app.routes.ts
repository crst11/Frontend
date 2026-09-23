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
  { path: '', redirectTo: 'guia', pathMatch: 'full' },
];
