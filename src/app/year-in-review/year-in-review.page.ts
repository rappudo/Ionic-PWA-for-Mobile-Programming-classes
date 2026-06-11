import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  flameOutline,
  starOutline,
  star as starFilled,
  trendingDownOutline,
  trendingUpOutline,
  tvOutline,
} from 'ionicons/icons';

import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { Anime } from '../models/anime';
import { AnimeService } from '../services/anime.service';
import { UserAnimeService } from '../services/user-anime.service';
import { formatWatchTime } from '../services/watch-time';

interface TopAnime {
  anime: Anime;
  score: number;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

@Component({
  selector: 'app-year-in-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'year-in-review.page.html',
  styleUrls: ['year-in-review.page.scss'],
  imports: [
    DecimalPipe,
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
})
export class YearInReviewPage {
  private readonly userData = inject(UserAnimeService);
  private readonly modalCtrl = inject(ModalController);

  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });
  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly currentYear = new Date().getFullYear();
  readonly previousYear = this.currentYear - 1;

  private completionsInYear(year: number): { animeId: string; episodes: number; date: Date }[] {
    const out: { animeId: string; episodes: number; date: Date }[] = [];
    for (const s of this.userData.statuses().values()) {
      if (s.status !== 'concluido') continue;
      const d = new Date(s.updated_at);
      if (d.getFullYear() !== year) continue;
      out.push({ animeId: s.anime_id, episodes: s.episodes_watched, date: d });
    }
    return out;
  }

  private ratingsInYear(year: number): { animeId: string; score: number; date: Date }[] {
    const out: { animeId: string; score: number; date: Date }[] = [];
    for (const r of this.userData.ratings().values()) {
      if (r.score === null) continue;
      const d = new Date(r.updated_at);
      if (d.getFullYear() !== year) continue;
      out.push({ animeId: r.anime_id, score: r.score, date: d });
    }
    return out;
  }

  readonly finishedCount = computed(() => this.completionsInYear(this.currentYear).length);
  readonly finishedCountPrev = computed(() => this.completionsInYear(this.previousYear).length);
  readonly finishedDelta = computed(() => this.finishedCount() - this.finishedCountPrev());

  readonly watchTime = computed(() => {
    const minutes = this.completionsInYear(this.currentYear).reduce(
      (s, c) => s + c.episodes * 24,
      0,
    );
    return formatWatchTime(minutes);
  });

  readonly watchTimePrev = computed(() => {
    const minutes = this.completionsInYear(this.previousYear).reduce(
      (s, c) => s + c.episodes * 24,
      0,
    );
    return formatWatchTime(minutes);
  });

  readonly averageScore = computed(() => {
    const ratings = this.ratingsInYear(this.currentYear);
    if (ratings.length === 0) return null;
    return ratings.reduce((s, r) => s + r.score, 0) / ratings.length;
  });

  readonly topAnimes = computed<TopAnime[]>(() => {
    const lookup = this.animesById();
    return this.ratingsInYear(this.currentYear)
      .map((r) => ({ anime: lookup.get(r.animeId), score: r.score }))
      .filter((x): x is TopAnime => x.anime !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  });

  readonly topGenre = computed<{ name: string; count: number } | null>(() => {
    const lookup = this.animesById();
    const counts = new Map<string, number>();
    for (const c of this.completionsInYear(this.currentYear)) {
      const anime = lookup.get(c.animeId);
      if (!anime) continue;
      for (const g of anime.generos) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    let best: { name: string; count: number } | null = null;
    for (const [name, count] of counts) {
      if (!best || count > best.count) best = { name, count };
    }
    return best;
  });

  readonly bestMonth = computed<{ name: string; count: number } | null>(() => {
    const counts = new Array(12).fill(0);
    for (const c of this.completionsInYear(this.currentYear)) {
      counts[c.date.getMonth()] += 1;
    }
    let bestIdx = -1;
    let bestCount = 0;
    for (let i = 0; i < 12; i++) {
      if (counts[i] > bestCount) {
        bestCount = counts[i];
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return null;
    return { name: MONTH_NAMES[bestIdx], count: bestCount };
  });

  readonly hasData = computed(
    () => this.finishedCount() > 0 || this.ratingsInYear(this.currentYear).length > 0,
  );

  constructor() {
    addIcons({
      'calendar-outline': calendarOutline,
      'flame-outline': flameOutline,
      'star-outline': starOutline,
      star: starFilled,
      'trending-down-outline': trendingDownOutline,
      'trending-up-outline': trendingUpOutline,
      'tv-outline': tvOutline,
    });
  }

  async openAnime(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }
}
