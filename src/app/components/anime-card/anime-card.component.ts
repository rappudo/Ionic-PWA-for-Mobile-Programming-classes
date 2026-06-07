import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonBadge, IonChip, IonLabel } from '@ionic/angular/standalone';

import { Anime } from '../../models/anime';
import { RECOMENDACAO_META, RecomendacaoMeta } from '../../models/recomendacao';

@Component({
  selector: 'app-anime-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './anime-card.component.html',
  styleUrls: ['./anime-card.component.scss'],
  imports: [IonBadge, IonChip, IonLabel],
})
export class AnimeCardComponent {
  readonly anime = input.required<Anime>();

  readonly tituloPrincipal = computed<string>(() => this.anime().nome[0]);
  readonly titulosAlternativos = computed<string[]>(() => this.anime().nome.slice(1));
  readonly recomendacaoMeta = computed<RecomendacaoMeta>(
    () => RECOMENDACAO_META[this.anime().recomendacao],
  );
}
