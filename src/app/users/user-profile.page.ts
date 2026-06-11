import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
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
  chatbubbleOutline,
  checkmarkOutline,
  personAddOutline,
  personCircleOutline,
  timeOutline,
  tvOutline,
} from 'ionicons/icons';

import { AnimeCoverComponent } from '../components/anime-cover/anime-cover.component';
import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { RatingThreadModalComponent } from '../components/rating-thread-modal/rating-thread-modal.component';
import { SkeletonGridComponent } from '../components/skeleton/skeleton-grid.component';
import { SkeletonRowComponent } from '../components/skeleton/skeleton-row.component';
import { Anime } from '../models/anime';
import { CustomList, CustomListItem, CustomListWithItems } from '../models/custom-list';
import { Profile } from '../models/profile';
import { AnimeRating, AnimeStatus, WatchStatus } from '../models/user-anime';
import { AnimeService } from '../services/anime.service';
import { AuthService } from '../services/auth.service';
import { FriendsService } from '../services/friends.service';
import { MatchService } from '../services/match.service';
import { SupabaseService } from '../services/supabase.service';
import { formatWatchTime } from '../services/watch-time';

interface RatedAnime {
  anime: Anime;
  rating: AnimeRating;
}

type FriendStatus = 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'user-profile.page.html',
  styleUrls: ['user-profile.page.scss'],
  imports: [
    AnimeCoverComponent,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    SkeletonGridComponent,
    SkeletonRowComponent,
  ],
  providers: [],
})
export class UserProfilePage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly friends = inject(FriendsService);
  private readonly match = inject(MatchService);
  private readonly modalCtrl = inject(ModalController);

  readonly profile = signal<Profile | null>(null);
  readonly ratings = signal<AnimeRating[]>([]);
  readonly favoriteIds = signal<string[]>([]);
  readonly statuses = signal<AnimeStatus[]>([]);
  readonly lists = signal<CustomListWithItems[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly busy = signal(false);

  readonly statusCounts = computed<Record<WatchStatus, number>>(() => {
    const base: Record<WatchStatus, number> = {
      assistindo: 0,
      concluido: 0,
      planejado: 0,
      pausado: 0,
      dropei: 0,
    };
    for (const s of this.statuses()) base[s.status] += 1;
    return base;
  });

  readonly watchTime = computed(() => {
    let total = 0;
    for (const s of this.statuses()) total += s.episodes_watched * 24;
    return formatWatchTime(total);
  });

  readonly matchResult = computed(() => {
    const p = this.profile();
    if (!p) return { score: null, common: 0 };
    if (this.friends.isFriend(p.id)) {
      return this.match.matchWith(p.id);
    }
    return this.match.matchWithExternal(this.ratings());
  });

  matchLabel(score: number | null): string {
    if (score === null) return '';
    if (score >= 85) return 'Combinam muito';
    if (score >= 70) return 'Bem combinados';
    if (score >= 50) return 'Combinação ok';
    if (score >= 30) return 'Pouco em comum';
    return 'Gostos opostos';
  }

  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });
  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly ratedItems = computed<RatedAnime[]>(() => {
    const lookup = this.animesById();
    return this.ratings()
      .map((r) => {
        const anime = lookup.get(r.anime_id);
        return anime ? { anime, rating: r } : null;
      })
      .filter((x): x is RatedAnime => x !== null);
  });

  readonly favoriteAnimes = computed<Anime[]>(() => {
    const lookup = this.animesById();
    return this.favoriteIds()
      .map((id) => lookup.get(id))
      .filter((a): a is Anime => a !== undefined);
  });

  readonly status = computed<FriendStatus>(() => {
    const me = this.auth.user();
    const other = this.profile();
    if (!me || !other) return 'none';
    if (me.id === other.id) return 'self';
    if (this.friends.accepted().some((v) => v.other.id === other.id)) return 'friend';
    const inView = this.friends.pendingIncoming().find((v) => v.other.id === other.id);
    if (inView) return 'incoming';
    const outView = this.friends.pendingOutgoing().find((v) => v.other.id === other.id);
    if (outView) return 'outgoing';
    return 'none';
  });

  constructor() {
    addIcons({
      'chatbubble-outline': chatbubbleOutline,
      'checkmark-outline': checkmarkOutline,
      'person-add-outline': personAddOutline,
      'person-circle-outline': personCircleOutline,
      'time-outline': timeOutline,
      'tv-outline': tvOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const username = (this.route.snapshot.paramMap.get('username') ?? '').toLowerCase();
    if (!username) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    await this.load(username);
  }

  async addFriend(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    this.busy.set(true);
    await this.friends.sendRequest(profile.username);
    this.busy.set(false);
  }

  async acceptFriend(): Promise<void> {
    const profile = this.profile();
    if (!profile || this.busy()) return;
    const view = this.friends.pendingIncoming().find((v) => v.other.id === profile.id);
    if (!view) return;
    this.busy.set(true);
    await this.friends.accept(view.friendship);
    this.busy.set(false);
  }

  async openAnime(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  async openThread(item: { anime: Anime; rating: AnimeRating }): Promise<void> {
    const owner = this.profile();
    if (!owner) return;
    const modal = await this.modalCtrl.create({
      component: RatingThreadModalComponent,
      componentProps: {
        ratingOwner: owner,
        anime: item.anime,
        rating: item.rating,
      },
    });
    await modal.present();
  }

  previewAnimes(list: CustomListWithItems, max: number): Anime[] {
    const lookup = this.animesById();
    return list.anime_ids
      .slice(0, max)
      .map((id) => lookup.get(id))
      .filter((a): a is Anime => a !== undefined);
  }

  private async load(username: string): Promise<void> {
    this.loading.set(true);

    if (username === (this.auth.profile()?.username ?? '').toLowerCase()) {
      await this.router.navigateByUrl('/profile', { replaceUrl: true });
      return;
    }

    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .maybeSingle<Profile>();

    if (!profile) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.profile.set(profile);

    const [ratingsRes, favoritesRes, statusRes, listsRes, itemsRes] = await Promise.all([
      this.supabase
        .from('anime_ratings')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false }),
      this.supabase
        .from('favorites')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('anime_status')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false }),
      this.supabase
        .from('custom_lists')
        .select('*')
        .eq('user_id', profile.id)
        .order('updated_at', { ascending: false }),
      this.supabase.from('custom_list_items').select('*'),
    ]);

    this.ratings.set((ratingsRes.data ?? []) as AnimeRating[]);
    this.favoriteIds.set(
      ((favoritesRes.data ?? []) as { anime_id: string }[]).map((f) => f.anime_id),
    );
    this.statuses.set((statusRes.data ?? []) as AnimeStatus[]);

    const rawLists = (listsRes.data ?? []) as CustomList[];
    const allItems = (itemsRes.data ?? []) as CustomListItem[];
    const itemsByList = new Map<string, string[]>();
    for (const item of allItems) {
      const arr = itemsByList.get(item.list_id) ?? [];
      arr.push(item.anime_id);
      itemsByList.set(item.list_id, arr);
    }
    this.lists.set(
      rawLists.map((l) => ({
        ...l,
        anime_ids: itemsByList.get(l.id) ?? [],
        role: 'owner' as const,
      })),
    );
    this.loading.set(false);
  }
}
