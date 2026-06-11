import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBadge,
  IonChip,
  IonIcon,
  IonInput,
  IonLabel,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bookmarkOutline,
  heart,
  heartOutline,
  openOutline,
  paperPlaneOutline,
  removeOutline,
  starOutline,
  star as starFilled,
} from 'ionicons/icons';

import { AddToListModalComponent } from '../add-to-list-modal/add-to-list-modal.component';
import { RecommendModalComponent } from '../recommend-modal/recommend-modal.component';
import { SimilarAnimesComponent } from '../similar-animes/similar-animes.component';
import { Anime } from '../../models/anime';
import { RECOMENDACAO_META, RecomendacaoMeta } from '../../models/recomendacao';
import { WATCH_STATUSES, WatchStatus } from '../../models/user-anime';
import { CustomListsService } from '../../services/custom-lists.service';
import { HapticsService } from '../../services/haptics.service';
import { hasStreamingLink, streamingSearchUrl } from '../../services/streaming-links';
import { UserAnimeService } from '../../services/user-anime.service';

const COMMENT_DEBOUNCE_MS = 800;

@Component({
  selector: 'app-anime-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anime-card.component.html',
  styleUrls: ['./anime-card.component.scss'],
  imports: [FormsModule, IonBadge, IonChip, IonIcon, IonInput, IonLabel, SimilarAnimesComponent],
})
export class AnimeCardComponent {
  private readonly userData = inject(UserAnimeService);
  private readonly listsService = inject(CustomListsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly haptics = inject(HapticsService);

  readonly anime = input.required<Anime>();

  readonly tituloPrincipal = computed<string>(() => this.anime().nome[0]);
  readonly titulosAlternativos = computed<string[]>(() => this.anime().nome.slice(1));
  readonly recomendacaoMeta = computed<RecomendacaoMeta>(
    () => RECOMENDACAO_META[this.anime().recomendacao],
  );

  readonly isFavorite = computed<boolean>(() => this.userData.isFavorite(this.anime().id));
  readonly currentScore = computed<number | null>(
    () => this.userData.ratingFor(this.anime().id)?.score ?? null,
  );
  readonly persistedComment = computed<string>(
    () => this.userData.ratingFor(this.anime().id)?.comment ?? '',
  );
  readonly listMembershipCount = computed<number>(
    () => this.listsService.listsContaining(this.anime().id).length,
  );

  readonly currentStatus = computed<WatchStatus | null>(
    () => this.userData.statusFor(this.anime().id)?.status ?? null,
  );
  readonly episodesWatched = computed<number>(
    () => this.userData.statusFor(this.anime().id)?.episodes_watched ?? 0,
  );
  readonly totalEpisodes = computed<number>(() => this.anime().episodios ?? 0);
  readonly statuses = WATCH_STATUSES;

  readonly commentDraft = signal('');
  readonly commentStatus = signal<'idle' | 'saving' | 'saved'>('idle');
  readonly stars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

  private commentTimer: ReturnType<typeof setTimeout> | null = null;
  private savedClearTimer: ReturnType<typeof setTimeout> | null = null;
  private lastAnimeId: string | null = null;

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'bookmark-outline': bookmarkOutline,
      heart,
      'heart-outline': heartOutline,
      'open-outline': openOutline,
      'paper-plane-outline': paperPlaneOutline,
      'remove-outline': removeOutline,
      star: starFilled,
      'star-outline': starOutline,
    });

    effect(() => {
      const id = this.anime().id;
      const persisted = this.persistedComment();
      if (id !== this.lastAnimeId) {
        this.lastAnimeId = id;
        this.commentDraft.set(persisted);
        this.commentStatus.set('idle');
        return;
      }
      if (persisted !== this.commentDraft() && this.commentStatus() !== 'saving') {
        this.commentDraft.set(persisted);
      }
    });
  }

  toggleFavorite(): void {
    void this.userData.toggleFavorite(this.anime().id);
  }

  async openAddToList(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AddToListModalComponent,
      componentProps: {
        animeId: this.anime().id,
        animeTitle: this.tituloPrincipal(),
      },
    });
    await modal.present();
  }

  async openRecommend(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: RecommendModalComponent,
      componentProps: {
        animeId: this.anime().id,
        animeTitle: this.tituloPrincipal(),
      },
    });
    await modal.present();
  }

  setStatus(status: WatchStatus): void {
    const next = this.currentStatus() === status ? null : status;
    void this.userData.setStatus(this.anime().id, next, this.totalEpisodes());
  }

  bumpEpisode(): void {
    void this.userData.bumpEpisode(this.anime().id, this.totalEpisodes());
  }

  decEpisode(): void {
    const next = Math.max(0, this.episodesWatched() - 1);
    void this.userData.setEpisodesWatched(this.anime().id, next, this.totalEpisodes());
  }

  onEpisodesInput(value: string | number | null | undefined): void {
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    if (Number.isNaN(parsed)) return;
    void this.userData.setEpisodesWatched(this.anime().id, parsed, this.totalEpisodes());
  }

  setScore(value: number): void {
    const current = this.currentScore();
    const next = current === value ? null : value;
    void this.userData.setScore(this.anime().id, next);
  }

  clearScore(): void {
    void this.userData.setScore(this.anime().id, null);
  }

  hasStreamingLink(platform: string): boolean {
    return hasStreamingLink(platform);
  }

  openPlatform(platform: string): void {
    const url = streamingSearchUrl(platform, this.tituloPrincipal());
    if (!url) return;
    this.haptics.light();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  onCommentChange(value: string): void {
    this.commentDraft.set(value);
    this.scheduleCommentSave();
  }

  onCommentBlur(): void {
    if (this.commentTimer) {
      clearTimeout(this.commentTimer);
      this.commentTimer = null;
    }
    void this.saveComment();
  }

  private scheduleCommentSave(): void {
    if (this.commentTimer) clearTimeout(this.commentTimer);
    this.commentTimer = setTimeout(() => {
      this.commentTimer = null;
      void this.saveComment();
    }, COMMENT_DEBOUNCE_MS);
  }

  private async saveComment(): Promise<void> {
    const next = this.commentDraft();
    if (next === this.persistedComment()) return;
    this.commentStatus.set('saving');
    await this.userData.setComment(this.anime().id, next);
    this.commentStatus.set('saved');
    if (this.savedClearTimer) clearTimeout(this.savedClearTimer);
    this.savedClearTimer = setTimeout(() => this.commentStatus.set('idle'), 1500);
  }
}
