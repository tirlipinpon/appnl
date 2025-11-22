import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
    canActivate: [authGuard]
  },
  {
    path: 'lessons',
    loadComponent: () => import('./features/lessons/lesson-list/lesson-list').then(m => m.LessonList),
    canActivate: [authGuard]
  },
  {
    path: 'lessons/:id',
    loadComponent: () => import('./features/lessons/lesson-detail/lesson-detail').then(m => m.LessonDetail),
    canActivate: [authGuard]
  },
  {
    path: 'admin/words',
    loadComponent: () => import('./features/admin/word-management/word-management').then(m => m.WordManagement),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
