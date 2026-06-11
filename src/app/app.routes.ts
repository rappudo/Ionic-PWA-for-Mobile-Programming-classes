import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'lists',
    canActivate: [authGuard],
    loadComponent: () => import('./lists/lists.page').then((m) => m.ListsPage),
  },
  {
    path: 'lists/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./lists/list-detail.page').then((m) => m.ListDetailPage),
  },
  {
    path: 'friends',
    canActivate: [authGuard],
    loadComponent: () => import('./friends/friends.page').then((m) => m.FriendsPage),
  },
  {
    path: 'users/:username',
    canActivate: [authGuard],
    loadComponent: () => import('./users/user-profile.page').then((m) => m.UserProfilePage),
  },
  {
    path: 'recommendations',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./recommendations/recommendations.page').then((m) => m.RecommendationsPage),
  },
  {
    path: 'feed',
    canActivate: [authGuard],
    loadComponent: () => import('./feed/feed.page').then((m) => m.FeedPage),
  },
  {
    path: 'surprise',
    canActivate: [authGuard],
    loadComponent: () => import('./surprise/surprise.page').then((m) => m.SurprisePage),
  },
  {
    path: 'stats',
    canActivate: [authGuard],
    loadComponent: () => import('./stats/stats.page').then((m) => m.StatsPage),
  },
  {
    path: 'year-in-review',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./year-in-review/year-in-review.page').then((m) => m.YearInReviewPage),
  },
  {
    path: 'share/lists/:token',
    loadComponent: () =>
      import('./shared-list/shared-list.page').then((m) => m.SharedListPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
