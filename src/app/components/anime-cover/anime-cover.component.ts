import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonIcon, IonImg } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { heart, star as starFilled } from 'ionicons/icons';

import { Anime } from '../../models/anime';
import { RECOMENDACAO_META } from '../../models/recomendacao';
import { WATCH_STATUSES, WatchStatus } from '../../models/user-anime';
import { UserAnimeService } from '../../services/user-anime.service';

const STATUS_META: Record<WatchStatus, { label: string; color: string }> = WATCH_STATUSES.reduce(
  (acc, s) => {
    acc[s.value] = { label: s.label, color: s.color };
    return acc;
  },
  {} as Record<WatchStatus, { label: string; color: string }>,
);

@Component({
  selector: 'app-anime-cover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anime-cover.component.html',
  styleUrls: ['./anime-cover.component.scss'],
  imports: [IonIcon, IonImg],
})
export class AnimeCoverComponent {
  private readonly userData = inject(UserAnimeService);

  readonly anime = input.required<Anime>();
  readonly select = output<Anime>();

  readonly tituloPrincipal = computed<string>(() => this.anime().nome[0]);
  readonly accentColor = computed<string>(
    () => `var(--ion-color-${RECOMENDACAO_META[this.anime().recomendacao].color})`,
  );
  readonly isFavorite = computed<boolean>(() => this.userData.isFavorite(this.anime().id));
  readonly score = computed<number | null>(
    () => this.userData.ratingFor(this.anime().id)?.score ?? null,
  );
  readonly statusInfo = computed(() => {
    const status = this.userData.statusFor(this.anime().id);
    if (!status) return null;
    return {
      status: status.status,
      episodes: status.episodes_watched,
      total: this.anime().episodios ?? 0,
      ...STATUS_META[status.status],
    };
  });

  constructor() {
    addIcons({ heart, star: starFilled });
  }

  onSelect(): void {
    this.select.emit(this.anime());
  }
}
