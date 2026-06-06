import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonImg } from '@ionic/angular/standalone';

import { Anime } from '../../models/anime';
import { RECOMENDACAO_META } from '../../models/recomendacao';

@Component({
  selector: 'app-anime-cover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anime-cover.component.html',
  styleUrls: ['./anime-cover.component.scss'],
  imports: [IonImg],
})
export class AnimeCoverComponent {
  readonly anime = input.required<Anime>();
  readonly select = output<Anime>();

  readonly tituloPrincipal = computed<string>(() => this.anime().nome[0]);
  readonly borderColor = computed<string>(
    () => `var(--ion-color-${RECOMENDACAO_META[this.anime().recomendacao].color})`,
  );

  onSelect(): void {
    this.select.emit(this.anime());
  }
}
