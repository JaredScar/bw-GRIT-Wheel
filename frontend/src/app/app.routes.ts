import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'nominate', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'nominate',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/nominate-page/nominate-page.component').then((m) => m.NominatePageComponent),
  },
  {
    path: 'nominations',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/feed-page/feed-page.component').then((m) => m.FeedPageComponent),
  },
  {
    path: 'rounds',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/rounds-page/rounds-page.component').then((m) => m.RoundsPageComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/admin-page/admin-page.component').then((m) => m.AdminPageComponent),
  },
  {
    path: 'leaderboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/leaderboard-page/leaderboard-page.component').then(
        (m) => m.LeaderboardPageComponent,
      ),
  },
  {
    path: 'people/:email',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/person-page/person-page.component').then((m) => m.PersonPageComponent),
  },
  { path: '**', redirectTo: 'nominate' },
];
