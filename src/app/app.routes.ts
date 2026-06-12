import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'share/lists/:token',
    loadComponent: () =>
      import('./shared-list/shared-list.page').then((m) => m.SharedListPage),
  },
  {
    // Authenticated app lives inside the navigation shell. The guard protects
    // the whole subtree; children render through the shell's router outlet.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage),
      },
      {
        path: 'lists',
        loadComponent: () => import('./lists/lists.page').then((m) => m.ListsPage),
      },
      {
        path: 'lists/:id',
        loadComponent: () => import('./lists/list-detail.page').then((m) => m.ListDetailPage),
      },
      {
        path: 'friends',
        loadComponent: () => import('./friends/friends.page').then((m) => m.FriendsPage),
      },
      {
        path: 'users/:username',
        loadComponent: () => import('./users/user-profile.page').then((m) => m.UserProfilePage),
      },
      {
        path: 'recommendations',
        loadComponent: () =>
          import('./recommendations/recommendations.page').then((m) => m.RecommendationsPage),
      },
      {
        path: 'feed',
        loadComponent: () => import('./feed/feed.page').then((m) => m.FeedPage),
      },
      {
        path: 'surprise',
        loadComponent: () => import('./surprise/surprise.page').then((m) => m.SurprisePage),
      },
      {
        path: 'stats',
        loadComponent: () => import('./stats/stats.page').then((m) => m.StatsPage),
      },
      {
        path: 'year-in-review',
        loadComponent: () =>
          import('./year-in-review/year-in-review.page').then((m) => m.YearInReviewPage),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
