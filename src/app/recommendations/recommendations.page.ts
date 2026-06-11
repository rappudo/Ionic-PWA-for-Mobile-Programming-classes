import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  diceOutline,
  flameOutline,
  peopleOutline,
  refreshOutline,
  sparklesOutline,
  starOutline,
  star as starFilled,
  sunnyOutline,
} from 'ionicons/icons';

import { AnimeCoverComponent } from '../components/anime-cover/anime-cover.component';
import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { SkeletonGridComponent } from '../components/skeleton/skeleton-grid.component';
import { SkeletonRowComponent } from '../components/skeleton/skeleton-row.component';
import { Anime, Recomendacao } from '../models/anime';
import { Profile } from '../models/profile';
import { AnimeRating, Favorite } from '../models/user-anime';
import { AnimeService } from '../services/anime.service';
import { AuthService } from '../services/auth.service';
import { FriendsService } from '../services/friends.service';
import { SupabaseService } from '../services/supabase.service';
import { UserAnimeService } from '../services/user-anime.service';

interface FriendRecommendation {
  anime: Anime;
  recommenders: { username: string; score: number | null }[];
  avgScore: number;
}

interface TrendingItem {
  anime: Anime;
  uniqueUsers: number;
}

const POSITIVE_SCORE_THRESHOLD = 7;
const RECOMENDACAO_RANK: Record<Recomendacao, number> = {
  veja_imediatamente: 0,
  veja: 1,
  media_prioridade: 2,
  baixa_prioridade: 3,
};

@Component({
  selector: 'app-recommendations',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'recommendations.page.html',
  styleUrls: ['recommendations.page.scss'],
  imports: [
    AnimeCoverComponent,
    DecimalPipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    RouterLink,
    SkeletonGridComponent,
    SkeletonRowComponent,
  ],
})
export class RecommendationsPage implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly userData = inject(UserAnimeService);
  private readonly friends = inject(FriendsService);
  private readonly modalCtrl = inject(ModalController);

  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });

  readonly loading = signal(true);
  readonly refreshing = signal(false);

  private readonly friendRatings = signal<AnimeRating[]>([]);
  private readonly friendFavorites = signal<Favorite[]>([]);
  private readonly trendingInteractions = signal<{ anime_id: string; user_id: string }[]>([]);

  private readonly seenIds = computed<Set<string>>(() => {
    const set = new Set<string>();
    for (const id of this.userData.ratings().keys()) set.add(id);
    for (const id of this.userData.favorites()) set.add(id);
    return set;
  });

  readonly dailyPick = computed<Anime | null>(() => {
    const all = this.animes();
    if (all.length === 0) return null;
    const userId = this.auth.user()?.id ?? '';
    const candidates = all.filter((a) => !this.seenIds().has(a.id));
    const pool = candidates.length > 0 ? candidates : all;
    const seed = hash(`${userId}-${todayKey()}`);
    return pool[seed % pool.length];
  });

  readonly personalRecs = computed<Anime[]>(() => {
    const all = this.animes();
    if (all.length === 0) return [];
    const seen = this.seenIds();
    const myRatings = this.userData.ratings();

    const genreScore = new Map<string, number>();
    const studioScore = new Map<string, number>();
    const animeById = new Map(all.map((a) => [a.id, a] as const));

    for (const rating of myRatings.values()) {
      const positive = (rating.score ?? 0) >= POSITIVE_SCORE_THRESHOLD;
      if (!positive) continue;
      const anime = animeById.get(rating.anime_id);
      if (!anime) continue;
      for (const g of anime.generos) genreScore.set(g, (genreScore.get(g) ?? 0) + 2);
      for (const s of anime.estudio) studioScore.set(s, (studioScore.get(s) ?? 0) + 1);
    }
    for (const id of this.userData.favorites()) {
      const anime = animeById.get(id);
      if (!anime) continue;
      for (const g of anime.generos) genreScore.set(g, (genreScore.get(g) ?? 0) + 1);
      for (const s of anime.estudio) studioScore.set(s, (studioScore.get(s) ?? 0) + 1);
    }

    if (genreScore.size === 0 && studioScore.size === 0) {
      return all
        .filter((a) => !seen.has(a.id))
        .sort((a, b) => RECOMENDACAO_RANK[a.recomendacao] - RECOMENDACAO_RANK[b.recomendacao])
        .slice(0, 10);
    }

    return all
      .filter((a) => !seen.has(a.id))
      .map((anime) => {
        let score = 0;
        for (const g of anime.generos) score += genreScore.get(g) ?? 0;
        for (const s of anime.estudio) score += studioScore.get(s) ?? 0;
        return { anime, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return RECOMENDACAO_RANK[a.anime.recomendacao] - RECOMENDACAO_RANK[b.anime.recomendacao];
      })
      .slice(0, 10)
      .map((x) => x.anime);
  });

  readonly trendingItems = computed<TrendingItem[]>(() => {
    const animeById = new Map(this.animes().map((a) => [a.id, a] as const));
    const usersByAnime = new Map<string, Set<string>>();
    for (const row of this.trendingInteractions()) {
      if (!animeById.has(row.anime_id)) continue;
      let set = usersByAnime.get(row.anime_id);
      if (!set) {
        set = new Set();
        usersByAnime.set(row.anime_id, set);
      }
      set.add(row.user_id);
    }
    const items: TrendingItem[] = [];
    for (const [animeId, users] of usersByAnime) {
      const anime = animeById.get(animeId);
      if (!anime) continue;
      items.push({ anime, uniqueUsers: users.size });
    }
    items.sort((a, b) => b.uniqueUsers - a.uniqueUsers);
    return items.slice(0, 10);
  });

  readonly friendRecs = computed<FriendRecommendation[]>(() => {
    const seen = this.seenIds();
    const animeById = new Map(this.animes().map((a) => [a.id, a] as const));
    const profilesById = new Map<string, Profile>();
    for (const view of this.friends.accepted()) profilesById.set(view.other.id, view.other);
    if (profilesById.size === 0) return [];

    const agg = new Map<
      string,
      { recommenders: { username: string; score: number | null }[]; scoreSum: number; scoreCount: number }
    >();

    const recordRec = (animeId: string, userId: string, score: number | null): void => {
      if (seen.has(animeId)) return;
      const profile = profilesById.get(userId);
      if (!profile) return;
      let entry = agg.get(animeId);
      if (!entry) {
        entry = { recommenders: [], scoreSum: 0, scoreCount: 0 };
        agg.set(animeId, entry);
      }
      if (entry.recommenders.some((r) => r.username === profile.username)) {
        if (score !== null) {
          const existing = entry.recommenders.find((r) => r.username === profile.username)!;
          if (existing.score === null) {
            existing.score = score;
            entry.scoreSum += score;
            entry.scoreCount += 1;
          }
        }
        return;
      }
      entry.recommenders.push({ username: profile.username, score });
      if (score !== null) {
        entry.scoreSum += score;
        entry.scoreCount += 1;
      }
    };

    for (const r of this.friendRatings()) {
      if ((r.score ?? 0) >= POSITIVE_SCORE_THRESHOLD) {
        recordRec(r.anime_id, r.user_id, r.score);
      }
    }
    for (const f of this.friendFavorites()) {
      recordRec(f.anime_id, f.user_id, null);
    }

    const recs: FriendRecommendation[] = [];
    for (const [animeId, entry] of agg) {
      const anime = animeById.get(animeId);
      if (!anime) continue;
      const avgScore = entry.scoreCount > 0 ? entry.scoreSum / entry.scoreCount : 0;
      recs.push({ anime, recommenders: entry.recommenders, avgScore });
    }
    recs.sort((a, b) => {
      if (b.recommenders.length !== a.recommenders.length) {
        return b.recommenders.length - a.recommenders.length;
      }
      return b.avgScore - a.avgScore;
    });
    return recs.slice(0, 10);
  });

  constructor() {
    addIcons({
      'dice-outline': diceOutline,
      'flame-outline': flameOutline,
      'people-outline': peopleOutline,
      'refresh-outline': refreshOutline,
      'sparkles-outline': sparklesOutline,
      'star-outline': starOutline,
      star: starFilled,
      'sunny-outline': sunnyOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.refreshFriendData(), this.refreshTrending()]);
    this.loading.set(false);
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    await Promise.all([this.refreshFriendData(), this.refreshTrending()]);
    this.refreshing.set(false);
  }

  async onRefresh(event: Event): Promise<void> {
    await Promise.all([this.refreshFriendData(), this.refreshTrending()]);
    (event as RefresherCustomEvent).detail.complete();
  }

  async openAnime(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  trackByAnimeId = (_: number, item: { anime: Anime }): string => item.anime.id;

  private async refreshTrending(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [ratingsRes, favoritesRes, statusRes] = await Promise.all([
      this.supabase
        .from('anime_ratings')
        .select('anime_id, user_id')
        .gte('updated_at', sevenDaysAgo)
        .limit(500),
      this.supabase
        .from('favorites')
        .select('anime_id, user_id')
        .gte('created_at', sevenDaysAgo)
        .limit(500),
      this.supabase
        .from('anime_status')
        .select('anime_id, user_id')
        .gte('updated_at', sevenDaysAgo)
        .limit(500),
    ]);

    const combined: { anime_id: string; user_id: string }[] = [];
    for (const row of (ratingsRes.data ?? []) as { anime_id: string; user_id: string }[]) {
      combined.push(row);
    }
    for (const row of (favoritesRes.data ?? []) as { anime_id: string; user_id: string }[]) {
      combined.push(row);
    }
    for (const row of (statusRes.data ?? []) as { anime_id: string; user_id: string }[]) {
      combined.push(row);
    }
    this.trendingInteractions.set(combined);
  }

  private async refreshFriendData(): Promise<void> {
    const friendIds = this.friends.accepted().map((v) => v.other.id);
    if (friendIds.length === 0) {
      this.friendRatings.set([]);
      this.friendFavorites.set([]);
      return;
    }
    const [ratingsRes, favoritesRes] = await Promise.all([
      this.supabase.from('anime_ratings').select('*').in('user_id', friendIds),
      this.supabase.from('favorites').select('*').in('user_id', friendIds),
    ]);
    this.friendRatings.set((ratingsRes.data ?? []) as AnimeRating[]);
    this.friendFavorites.set((favoritesRes.data ?? []) as Favorite[]);
  }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}
