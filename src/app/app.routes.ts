import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'guia',
    loadComponent: () => import('./features/guia/categorias/categorias').then((m) => m.Categorias),
  },
  { path: '', redirectTo: 'guia', pathMatch: 'full' },
];
