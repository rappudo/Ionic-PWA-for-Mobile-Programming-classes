import { ChangeDetectionStrategy, Component, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { IonIcon, IonRouterOutlet } from '@ionic/angular/standalone';
import { filter, map, startWith } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  home,
  homeOutline,
  people,
  peopleOutline,
  person,
  personOutline,
  sparkles,
  sparklesOutline,
  statsChart,
  statsChartOutline,
} from 'ionicons/icons';

import { FriendsService } from '../services/friends.service';
import { RecommendationsInboxService } from '../services/recommendations-inbox.service';

interface NavItem {
  readonly route: string;
  readonly label: string;
  readonly icon: string;
  readonly iconActive: string;
  readonly badge?: Signal<number>;
  /** Extra path prefixes that should keep this destination highlighted. */
  readonly aliases?: readonly string[];
}

/**
 * Persistent navigation shell. Renders the authenticated routes through its
 * own ion-router-outlet and wraps them with a responsive chrome: a bottom tab
 * bar on phones that becomes a vertical side rail on wider screens. This is the
 * app's single source of global navigation — pages no longer carry their own
 * scattered nav icons.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'app-shell.component.html',
  styleUrls: ['app-shell.component.scss'],
  imports: [IonRouterOutlet, IonIcon, RouterLink],
})
export class AppShellComponent {
  private readonly friends = inject(FriendsService);
  private readonly inbox = inject(RecommendationsInboxService);
  private readonly router = inject(Router);

  /** Aggregate of unseen social signals surfaced on the Social destination. */
  readonly socialCount = computed(() => this.friends.incomingCount() + this.inbox.pendingCount());

  /** Current URL as a signal so highlighting reacts to navigation. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  isActive(item: NavItem): boolean {
    const url = this.currentUrl();
    const paths = [item.route, ...(item.aliases ?? [])];
    return paths.some((p) => url === p || url.startsWith(p + '/'));
  }

  readonly items: readonly NavItem[] = [
    { route: '/home', label: 'Início', icon: 'home-outline', iconActive: 'home' },
    {
      route: '/recommendations',
      label: 'Descobrir',
      icon: 'sparkles-outline',
      iconActive: 'sparkles',
      aliases: ['/surprise'],
    },
    {
      route: '/feed',
      label: 'Social',
      icon: 'people-outline',
      iconActive: 'people',
      badge: this.socialCount,
      aliases: ['/friends', '/users'],
    },
    {
      route: '/stats',
      label: 'Resumo',
      icon: 'stats-chart-outline',
      iconActive: 'stats-chart',
      aliases: ['/year-in-review'],
    },
    {
      route: '/profile',
      label: 'Perfil',
      icon: 'person-outline',
      iconActive: 'person',
      aliases: ['/lists'],
    },
  ];

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      home,
      'sparkles-outline': sparklesOutline,
      sparkles,
      'people-outline': peopleOutline,
      people,
      'stats-chart-outline': statsChartOutline,
      'stats-chart': statsChart,
      'person-outline': personOutline,
      person,
    });
  }
}
