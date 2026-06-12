import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { flame, heart, heartOutline, informationCircleOutline } from 'ionicons/icons';

import { Anime } from '../../models/anime';
import { RECOMENDACAO_META } from '../../models/recomendacao';
import { UserAnimeService } from '../../services/user-anime.service';

/**
 * Cinematic featured banner: the anime's cover is blurred and scaled to form a
 * backdrop, with a scrim gradient and content (title, meta, synopsis, CTAs)
 * laid over it. Used at the top of the discovery screen.
 */
@Component({
  selector: 'app-hero-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-banner.component.html',
  styleUrls: ['./hero-banner.component.scss'],
  imports: [IonIcon],
})
export class HeroBannerComponent {
  private readonly userData = inject(UserAnimeService);

  readonly anime = input.required<Anime>();
  readonly select = output<Anime>();

  readonly title = computed(() => this.anime().nome[0]);
  readonly accentColor = computed(
    () => `var(--ion-color-${RECOMENDACAO_META[this.anime().recomendacao].color})`,
  );
  readonly priorityLabel = computed(() => RECOMENDACAO_META[this.anime().recomendacao].label);
  readonly year = computed(() => this.anime().dataLancamento?.slice(0, 4) || null);
  readonly topGenres = computed(() => this.anime().generos.slice(0, 3));
  readonly isFavorite = computed(() => this.userData.isFavorite(this.anime().id));

  constructor() {
    addIcons({
      flame,
      heart,
      'heart-outline': heartOutline,
      'information-circle-outline': informationCircleOutline,
    });
  }

  open(): void {
    this.select.emit(this.anime());
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    void this.userData.toggleFavorite(this.anime().id);
  }
}
