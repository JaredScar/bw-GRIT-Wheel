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
    children: [
      { path: '', redirectTo: 'rounds', pathMatch: 'full' },
      {
        path: 'rounds',
        loadComponent: () =>
          import('./pages/admin-rounds-page/admin-rounds-page.component').then(
            (m) => m.AdminRoundsPageComponent,
          ),
      },
      {
        path: 'directory',
        loadComponent: () =>
          import('./pages/admin-directory-page/admin-directory-page.component').then(
            (m) => m.AdminDirectoryPageComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin-users-page/admin-users-page.component').then(
            (m) => m.AdminUsersPageComponent,
          ),
      },
      {
        path: 'teams',
        loadComponent: () =>
          import('./pages/admin-teams-page/admin-teams-page.component').then(
            (m) => m.AdminTeamsPageComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/admin-analytics-page/admin-analytics-page.component').then(
            (m) => m.AdminAnalyticsPageComponent,
          ),
      },
    ],
  },
  // Leaderboard is temporarily disabled; keeping the route commented out (rather than
  // deleting the page) so it can be re-enabled later without rebuilding it from scratch.
  // {
  //   path: 'leaderboard',
  //   canActivate: [authGuard],
  //   loadComponent: () =>
  //     import('./pages/leaderboard-page/leaderboard-page.component').then(
  //       (m) => m.LeaderboardPageComponent,
  //     ),
  // },
  {
    path: 'people/:email',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/person-page/person-page.component').then((m) => m.PersonPageComponent),
  },
  { path: '**', redirectTo: 'nominate' },
];
