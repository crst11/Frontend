import { Routes } from '@angular/router';
import { sessionGuard } from './core/session/session.guard';

export const routes: Routes = [
  {
    path: 'guia',
    loadComponent: () => import('./features/guide/categories/categories').then((m) => m.Categories),
  },
  {
    path: 'cuenta/registro',
    loadComponent: () => import('./features/account/register/register').then((m) => m.Register),
  },
  {
    path: 'cuenta/verificacion',
    loadComponent: () => import('./features/account/verification/verification').then((m) => m.Verification),
  },
  {
    path: 'cuenta/entrar',
    loadComponent: () =>
      import('./features/account/login/login').then((m) => m.Login),
  },
  {
    path: 'cuenta/mi-cuenta',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/account/my-account/my-account').then((m) => m.MyAccount),
  },
  { path: '', redirectTo: 'guia', pathMatch: 'full' },
];
