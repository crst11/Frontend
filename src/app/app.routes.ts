import { Routes } from '@angular/router';
import { sessionGuard } from './core/session/session.guard';

export const routes: Routes = [
  {
    path: 'guia',
    loadComponent: () =>
      import('./features/guide/institutional-guide/institutional-guide').then((m) => m.InstitutionalGuide),
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
    path: 'cuenta/recuperar',
    loadComponent: () =>
      import('./features/account/password-recovery/password-recovery').then((m) => m.PasswordRecovery),
  },
  {
    path: 'cuenta/nueva-contrasena',
    loadComponent: () => import('./features/account/password-reset/password-reset').then((m) => m.PasswordReset),
  },
  {
    path: 'cuenta/mi-cuenta',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/account/my-account/my-account').then((m) => m.MyAccount),
  },
  {
    path: 'cuenta/mis-sesiones',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/account/my-sessions/my-sessions').then((m) => m.MySessions),
  },
  {
    path: 'cuenta/plan-de-estudios',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/account/study-plan/study-plan').then((m) => m.StudyPlan),
  },
  {
    path: 'cuenta/historial',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/account/academic-record/academic-record').then((m) => m.AcademicRecord),
  },
  {
    path: 'cuenta/importar-reporte',
    canActivate: [sessionGuard],
    loadComponent: () => import('./features/importing/import-report/import-report').then((m) => m.ImportReport),
  },
  {
    path: 'calificaciones/mis-notas',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/grading/evaluation-structure/evaluation-structure').then(
        (m) => m.EvaluationStructure,
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/entry/welcome/welcome').then((m) => m.Welcome),
  },
  { path: '**', redirectTo: '' },
];
