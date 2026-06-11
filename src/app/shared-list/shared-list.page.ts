import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, logInOutline, personCircleOutline } from 'ionicons/icons';

import { AnimeCoverComponent } from '../components/anime-cover/anime-cover.component';
import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { SkeletonGridComponent } from '../components/skeleton/skeleton-grid.component';
import { Anime } from '../models/anime';
import { CustomList, CustomListItem } from '../models/custom-list';
import { Profile } from '../models/profile';
import { AnimeService } from '../services/anime.service';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-shared-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'shared-list.page.html',
  styleUrls: ['shared-list.page.scss'],
  imports: [
    AnimeCoverComponent,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
    SkeletonGridComponent,
  ],
})
export class SharedListPage implements OnInit {
  private readonly supabase = inject(SupabaseService).client;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);

  private readonly animes = toSignal(inject(AnimeService).list(), { initialValue: [] as Anime[] });
  private readonly animesById = computed(() => {
    const map = new Map<string, Anime>();
    for (const a of this.animes()) map.set(a.id, a);
    return map;
  });

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly list = signal<CustomList | null>(null);
  readonly owner = signal<Profile | null>(null);
  readonly animeIds = signal<string[]>([]);

  readonly isAuthenticated = this.auth.isAuthenticated;

  readonly items = computed<Anime[]>(() => {
    const lookup = this.animesById();
    return this.animeIds()
      .map((id) => lookup.get(id))
      .filter((a): a is Anime => a !== undefined);
  });

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'log-in-outline': logInOutline,
      'person-circle-outline': personCircleOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    await this.load(token);
  }

  async openAnime(anime: Anime): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }

  goToApp(): void {
    void this.router.navigateByUrl(this.auth.isAuthenticated() ? '/home' : '/auth');
  }

  openOwnerProfile(): void {
    const owner = this.owner();
    if (!owner) return;
    if (this.auth.isAuthenticated()) {
      void this.router.navigate(['/users', owner.username]);
    }
  }

  private async load(token: string): Promise<void> {
    this.loading.set(true);
    const { data: list } = await this.supabase
      .from('custom_lists')
      .select('*')
      .eq('share_token', token)
      .eq('is_public', true)
      .maybeSingle<CustomList>();

    if (!list) {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    this.list.set(list);

    const [itemsRes, ownerRes] = await Promise.all([
      this.supabase
        .from('custom_list_items')
        .select('*')
        .eq('list_id', list.id)
        .order('position', { ascending: true })
        .order('added_at', { ascending: false }),
      this.supabase.from('profiles').select('*').eq('id', list.user_id).maybeSingle<Profile>(),
    ]);

    this.animeIds.set(((itemsRes.data ?? []) as CustomListItem[]).map((i) => i.anime_id));
    this.owner.set(ownerRes.data ?? null);
    this.loading.set(false);
  }
}
