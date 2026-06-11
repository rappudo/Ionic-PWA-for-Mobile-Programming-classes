import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  chevronForwardOutline,
  sparklesOutline,
  statsChartOutline,
  tvOutline,
} from 'ionicons/icons';

import { Anime } from '../models/anime';
import { WATCH_STATUSES, WatchStatus } from '../models/user-anime';
import { AnimeService } from '../services/anime.service';
import { UserAnimeService } from '../services/user-anime.service';
import { formatWatchTime } from '../services/watch-time';

interface MonthBucket {
  key: string;
  label: string;
  count: number;
}

interface StatusSlice {
  status: WatchStatus;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

interface NamedCount {
  name: string;
  count: number;
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

@Component({
  selector: 'app-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'stats.page.html',
  styleUrls: ['stats.page.scss'],
  imports: [
    DecimalPipe,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class StatsPage {
  readonly currentYear = new Date().getFullYear();

  private readonly userData = inject(UserAnimeService);
  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });

  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly scoreBars = computed(() => {
    const counts = Array.from({ length: 10 }, () => 0);
    for (const r of this.userData.ratings().values()) {
      if (r.score === null) continue;
      counts[r.score - 1] += 1;
    }
    const max = Math.max(1, ...counts);
    return counts.map((c, i) => ({ score: i + 1, count: c, height: (c / max) * 100 }));
  });

  readonly totalRated = computed(() => {
    let total = 0;
    for (const r of this.userData.ratings().values()) {
      if (r.score !== null) total += 1;
    }
    return total;
  });

  readonly averageScore = computed(() => {
    let sum = 0;
    let n = 0;
    for (const r of this.userData.ratings().values()) {
      if (r.score === null) continue;
      sum += r.score;
      n += 1;
    }
    return n === 0 ? null : sum / n;
  });

  readonly statusSlices = computed<StatusSlice[]>(() => {
    const counts: Record<WatchStatus, number> = {
      assistindo: 0,
      concluido: 0,
      planejado: 0,
      pausado: 0,
      dropei: 0,
    };
    for (const s of this.userData.statuses().values()) counts[s.status] += 1;
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return WATCH_STATUSES.map((meta) => ({
      status: meta.value,
      label: meta.label,
      color: meta.color,
      count: counts[meta.value],
      percentage: total === 0 ? 0 : (counts[meta.value] / total) * 100,
    }));
  });

  readonly totalStatus = computed(() => this.userData.statuses().size);

  readonly donutGradient = computed(() => {
    const slices = this.statusSlices().filter((s) => s.count > 0);
    if (slices.length === 0) return 'var(--md-surface-2)';
    const parts: string[] = [];
    let acc = 0;
    for (const slice of slices) {
      const start = acc;
      const end = acc + slice.percentage;
      parts.push(`${slice.color} ${start}% ${end}%`);
      acc = end;
    }
    return `conic-gradient(${parts.join(', ')})`;
  });

  readonly topGenres = computed<NamedCount[]>(() => this.tallyAttribute('generos').slice(0, 10));
  readonly topStudios = computed<NamedCount[]>(() => this.tallyAttribute('estudio').slice(0, 8));

  readonly monthlyCompletions = computed<MonthBucket[]>(() => {
    const counts = new Map<string, number>();
    for (const s of this.userData.statuses().values()) {
      if (s.status !== 'concluido') continue;
      const d = new Date(s.updated_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const now = new Date();
    const buckets: MonthBucket[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const yearSuffix = d.getFullYear() % 100;
      buckets.push({
        key,
        label: `${MONTH_LABELS[d.getMonth()]}/${yearSuffix}`,
        count: counts.get(key) ?? 0,
      });
    }
    return buckets;
  });

  readonly monthBars = computed(() => {
    const buckets = this.monthlyCompletions();
    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({ ...b, height: (b.count / max) * 100 }));
  });

  readonly watchTime = computed(() => formatWatchTime(this.userData.watchTimeMinutes()));

  constructor() {
    addIcons({
      'bar-chart-outline': barChartOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'sparkles-outline': sparklesOutline,
      'stats-chart-outline': statsChartOutline,
      'tv-outline': tvOutline,
    });
  }

  private tallyAttribute(key: 'generos' | 'estudio'): NamedCount[] {
    const counts = new Map<string, number>();
    const lookup = this.animesById();
    const tally = (animeId: string, weight: number) => {
      const anime = lookup.get(animeId);
      if (!anime) return;
      for (const value of anime[key]) {
        counts.set(value, (counts.get(value) ?? 0) + weight);
      }
    };
    for (const r of this.userData.ratings().values()) {
      if (r.score !== null && r.score >= 7) tally(r.anime_id, 2);
    }
    for (const id of this.userData.favorites()) tally(id, 2);
    for (const s of this.userData.statuses().values()) {
      if (s.status === 'concluido') tally(s.anime_id, 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }
}
