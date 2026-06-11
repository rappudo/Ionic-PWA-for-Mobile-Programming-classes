import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
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
  bookmarkOutline,
  chatbubbleOutline,
  closeOutline,
  heart,
  personCircleOutline,
  refreshOutline,
  starOutline,
  star as starFilled,
  timeOutline,
} from 'ionicons/icons';

import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { RatingThreadModalComponent } from '../components/rating-thread-modal/rating-thread-modal.component';
import { SkeletonRowComponent } from '../components/skeleton/skeleton-row.component';
import { Anime } from '../models/anime';
import { CustomList } from '../models/custom-list';
import { Profile } from '../models/profile';
import { IncomingRecommendation } from '../models/anime-recommendation';
import { AnimeRating, AnimeStatus, Favorite, WATCH_STATUSES, WatchStatus } from '../models/user-anime';
import { AnimeService } from '../services/anime.service';
import { FriendsService } from '../services/friends.service';
import { RecommendationsInboxService } from '../services/recommendations-inbox.service';
import { SupabaseService } from '../services/supabase.service';

type FeedItem =
  | {
      kind: 'rated';
      at: string;
      user: Profile;
      anime: Anime;
      score: number | null;
      comment: string | null;
    }
  | { kind: 'favorited'; at: string; user: Profile; anime: Anime }
  | {
      kind: 'status';
      at: string;
      user: Profile;
      anime: Anime;
      status: WatchStatus;
      episodes: number;
      total: number;
    }
  | { kind: 'list'; at: string; user: Profile; list: CustomList };

const STATUS_VERB: Record<WatchStatus, string> = {
  assistindo: 'começou a assistir',
  concluido: 'concluiu',
  planejado: 'planeja assistir',
  pausado: 'pausou',
  dropei: 'dropou',
};

const STATUS_COLOR: Record<WatchStatus, string> = WATCH_STATUSES.reduce(
  (acc, s) => {
    acc[s.value] = s.color;
    return acc;
  },
  {} as Record<WatchStatus, string>,
);

@Component({
  selector: 'app-feed',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'feed.page.html',
  styleUrls: ['feed.page.scss'],
  imports: [
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
    SkeletonRowComponent,
  ],
})
export class FeedPage implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly friends = inject(FriendsService);
  private readonly inbox = inject(RecommendationsInboxService);
  private readonly modalCtrl = inject(ModalController);
  private readonly router = inject(Router);

  private readonly animes = toSignal(inject(AnimeService).list(), {
    initialValue: [] as Anime[],
  });
  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly loading = signal(true);
  readonly items = signal<FeedItem[]>([]);

  readonly hasFriends = computed(() => this.friends.accepted().length > 0);

  readonly pendingRecs = computed<{ rec: IncomingRecommendation; anime: Anime }[]>(() => {
    const lookup = this.animesById();
    const out: { rec: IncomingRecommendation; anime: Anime }[] = [];
    for (const rec of this.inbox.pending()) {
      const anime = lookup.get(rec.anime_id);
      if (anime) out.push({ rec, anime });
    }
    return out;
  });

  constructor() {
    addIcons({
      'bookmark-outline': bookmarkOutline,
      'chatbubble-outline': chatbubbleOutline,
      'close-outline': closeOutline,
      heart,
      'person-circle-outline': personCircleOutline,
      'refresh-outline': refreshOutline,
      'star-outline': starOutline,
      star: starFilled,
      'time-outline': timeOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async onRefresh(event: Event): Promise<void> {
    await this.load();
    (event as RefresherCustomEvent).detail.complete();
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  async openAnime(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  async openThread(
    user: Profile,
    anime: Anime,
    score: number | null,
    comment: string | null,
    at: string,
  ): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: RatingThreadModalComponent,
      componentProps: {
        ratingOwner: user,
        anime,
        rating: {
          user_id: user.id,
          anime_id: anime.id,
          score,
          comment,
          created_at: at,
          updated_at: at,
        },
      },
    });
    await modal.present();
  }

  openProfile(username: string): void {
    void this.router.navigate(['/users', username]);
  }

  dismissRec(id: string): void {
    void this.inbox.dismiss(id);
  }

  timeAgo(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 30) return `há ${d}d`;
    const mo = Math.floor(d / 30);
    return `há ${mo}mes${mo > 1 ? 'es' : ''}`;
  }

  statusVerb(status: WatchStatus): string {
    return STATUS_VERB[status];
  }

  statusColor(status: WatchStatus): string {
    return STATUS_COLOR[status];
  }

  trackByIndex(index: number): number {
    return index;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const friendsList = this.friends.accepted();
    if (friendsList.length === 0) {
      this.items.set([]);
      this.loading.set(false);
      return;
    }
    const friendIds = friendsList.map((v) => v.other.id);
    const profileById = new Map<string, Profile>();
    for (const v of friendsList) profileById.set(v.other.id, v.other);

    const [ratingsRes, favoritesRes, statusRes, listsRes] = await Promise.all([
      this.supabase
        .from('anime_ratings')
        .select('*')
        .in('user_id', friendIds)
        .order('updated_at', { ascending: false })
        .limit(30),
      this.supabase
        .from('favorites')
        .select('*')
        .in('user_id', friendIds)
        .order('created_at', { ascending: false })
        .limit(30),
      this.supabase
        .from('anime_status')
        .select('*')
        .in('user_id', friendIds)
        .order('updated_at', { ascending: false })
        .limit(30),
      this.supabase
        .from('custom_lists')
        .select('*')
        .in('user_id', friendIds)
        .order('updated_at', { ascending: false })
        .limit(15),
    ]);

    const lookup = this.animesById();
    const items: FeedItem[] = [];

    for (const r of (ratingsRes.data ?? []) as AnimeRating[]) {
      const user = profileById.get(r.user_id);
      const anime = lookup.get(r.anime_id);
      if (!user || !anime) continue;
      items.push({
        kind: 'rated',
        at: r.updated_at,
        user,
        anime,
        score: r.score,
        comment: r.comment,
      });
    }
    for (const f of (favoritesRes.data ?? []) as Favorite[]) {
      const user = profileById.get(f.user_id);
      const anime = lookup.get(f.anime_id);
      if (!user || !anime) continue;
      items.push({ kind: 'favorited', at: f.created_at, user, anime });
    }
    for (const s of (statusRes.data ?? []) as AnimeStatus[]) {
      const user = profileById.get(s.user_id);
      const anime = lookup.get(s.anime_id);
      if (!user || !anime) continue;
      items.push({
        kind: 'status',
        at: s.updated_at,
        user,
        anime,
        status: s.status,
        episodes: s.episodes_watched,
        total: anime.episodios ?? 0,
      });
    }
    for (const l of (listsRes.data ?? []) as CustomList[]) {
      const user = profileById.get(l.user_id);
      if (!user) continue;
      items.push({ kind: 'list', at: l.updated_at, user, list: l });
    }

    items.sort((a, b) => b.at.localeCompare(a.at));
    this.items.set(items.slice(0, 60));
    this.loading.set(false);
  }
}
