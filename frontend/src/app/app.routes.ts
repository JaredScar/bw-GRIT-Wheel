import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { requirePermission } from './guards/permission.guard';

export const routes: Routes = [
  // Falls through to whichever page this account's access role allows: requirePermission on
  // /nominate redirects onward when the account can't nominate.
  { path: '', redirectTo: 'nominate', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'nominate',
    canActivate: [authGuard, requirePermission('nomination:create')],
    loadComponent: () =>
      import('./pages/nominate-page/nominate-page.component').then((m) => m.NominatePageComponent),
  },
  {
    path: 'nominations',
    canActivate: [authGuard, requirePermission('nomination:view')],
    loadComponent: () =>
      import('./pages/feed-page/feed-page.component').then((m) => m.FeedPageComponent),
  },
  {
    path: 'rounds',
    canActivate: [authGuard, requirePermission('hall:view')],
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
        path: 'access',
        loadComponent: () =>
          import('./pages/admin-access-page/admin-access-page.component').then(
            (m) => m.AdminAccessPageComponent,
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
  //   canActivate: [authGuard, requirePermission('person:view')],
  //   loadComponent: () =>
  //     import('./pages/leaderboard-page/leaderboard-page.component').then(
  //       (m) => m.LeaderboardPageComponent,
  //     ),
  // },
  {
    path: 'people/:email',
    canActivate: [authGuard, requirePermission('person:view')],
    loadComponent: () =>
      import('./pages/person-page/person-page.component').then((m) => m.PersonPageComponent),
  },
  // Terminal page for accounts whose access role grants nothing navigable — without it,
  // a denied navigation would have nowhere to redirect to.
  {
    path: 'no-access',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/no-access-page/no-access-page.component').then((m) => m.NoAccessPageComponent),
  },
  { path: '**', redirectTo: 'nominate' },
];
