import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { dice, diceOutline, openOutline, refreshOutline, sparklesOutline } from 'ionicons/icons';

import { AnimeDetailModalComponent } from '../components/anime-detail-modal/anime-detail-modal.component';
import { Anime, Recomendacao } from '../models/anime';
import { RECOMENDACAO_META } from '../models/recomendacao';
import { AnimeService } from '../services/anime.service';
import { UserAnimeService } from '../services/user-anime.service';

type SeenFilter = 'any' | 'unseen' | 'planejado';

const RECOMENDACAO_ORDER: Recomendacao[] = [
  'veja_imediatamente',
  'veja',
  'media_prioridade',
  'baixa_prioridade',
];

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

@Component({
  selector: 'app-surprise',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'surprise.page.html',
  styleUrls: ['surprise.page.scss'],
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
  ],
})
export class SurprisePage {
  private readonly userData = inject(UserAnimeService);
  private readonly modalCtrl = inject(ModalController);

  private readonly animes = toSignal(inject(AnimeService).list(), {
    initialValue: [] as Anime[],
  });

  readonly seenFilter = signal<SeenFilter>('unseen');
  readonly genreFilter = signal<string>('');
  readonly priorityFilter = signal<Recomendacao | ''>('');
  readonly platformFilter = signal<string>('');

  readonly current = signal<Anime | null>(null);
  readonly spinning = signal(false);
  readonly hasSpun = signal(false);

  readonly availableGenres = computed(() => uniqueSorted(this.animes().flatMap((a) => a.generos)));
  readonly availablePlatforms = computed(() =>
    uniqueSorted(this.animes().flatMap((a) => a.ondeVer)),
  );
  readonly availablePriorities = computed(() => {
    const present = new Set(this.animes().map((a) => a.recomendacao));
    return RECOMENDACAO_ORDER.filter((r) => present.has(r));
  });

  readonly priorityLabel = (r: Recomendacao): string => RECOMENDACAO_META[r].label;

  readonly pool = computed<Anime[]>(() => {
    const seen = this.seenFilter();
    const genre = this.genreFilter();
    const platform = this.platformFilter();
    const priority = this.priorityFilter();

    const ratings = this.userData.ratings();
    const statuses = this.userData.statuses();
    const favorites = this.userData.favorites();

    return this.animes().filter((anime) => {
      if (seen === 'unseen') {
        const status = statuses.get(anime.id)?.status;
        if (status === 'concluido' || status === 'dropei') return false;
        if (ratings.has(anime.id)) return false;
        if (favorites.has(anime.id)) return false;
      }
      if (seen === 'planejado') {
        if (statuses.get(anime.id)?.status !== 'planejado') return false;
      }
      if (genre && !anime.generos.includes(genre)) return false;
      if (platform && !anime.ondeVer.includes(platform)) return false;
      if (priority && anime.recomendacao !== priority) return false;
      return true;
    });
  });

  constructor() {
    addIcons({
      dice,
      'dice-outline': diceOutline,
      'open-outline': openOutline,
      'refresh-outline': refreshOutline,
      'sparkles-outline': sparklesOutline,
    });
  }

  onSeenChange(event: Event): void {
    const value = (event as CustomEvent<{ value: SeenFilter }>).detail.value;
    this.seenFilter.set(value);
  }

  onGenreChange(event: Event): void {
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    this.genreFilter.set(value);
  }

  onPriorityChange(event: Event): void {
    const value = (event as CustomEvent<{ value: Recomendacao | '' }>).detail.value;
    this.priorityFilter.set(value);
  }

  onPlatformChange(event: Event): void {
    const value = (event as CustomEvent<{ value: string }>).detail.value;
    this.platformFilter.set(value);
  }

  clearFilters(): void {
    this.seenFilter.set('unseen');
    this.genreFilter.set('');
    this.priorityFilter.set('');
    this.platformFilter.set('');
  }

  async spin(): Promise<void> {
    if (this.spinning()) return;
    const pool = this.pool();
    if (pool.length === 0) {
      this.current.set(null);
      this.hasSpun.set(true);
      return;
    }

    this.spinning.set(true);
    this.hasSpun.set(true);

    const cycles = Math.min(8, Math.max(4, pool.length));
    for (let i = 0; i < cycles; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      this.current.set(pick);
      await new Promise<void>((r) => setTimeout(r, 90 + i * 18));
    }

    const final = pool[Math.floor(Math.random() * pool.length)];
    this.current.set(final);
    this.spinning.set(false);
  }

  async openDetail(): Promise<void> {
    const anime = this.current();
    if (!anime) return;
    const modal = await this.modalCtrl.create({
      component: AnimeDetailModalComponent,
      componentProps: { anime },
      cssClass: 'anime-detail-modal',
    });
    await modal.present();
  }
}
