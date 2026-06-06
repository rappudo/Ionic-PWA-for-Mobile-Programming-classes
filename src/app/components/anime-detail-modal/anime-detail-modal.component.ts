import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

import { Anime } from '../../models/anime';
import { AnimeCardComponent } from '../anime-card/anime-card.component';

@Component({
  selector: 'app-anime-detail-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimeCardComponent, IonButton, IonContent, IonIcon],
  styles: [
    `
      .close-fab {
        position: fixed;
        top: max(12px, env(safe-area-inset-top));
        right: 12px;
        z-index: 10;
        --background: rgba(0, 0, 0, 0.55);
        --background-hover: rgba(0, 0, 0, 0.7);
        --background-activated: rgba(0, 0, 0, 0.7);
        --color: #fff;
        --border-radius: 50%;
        --padding-start: 0;
        --padding-end: 0;
        width: 40px;
        height: 40px;
        margin: 0;
      }

      .close-fab ion-icon {
        font-size: 22px;
      }
    `,
  ],
  template: `
    <ion-content [fullscreen]="true">
      <ion-button
        class="close-fab"
        shape="round"
        aria-label="Fechar"
        (click)="close()"
      >
        <ion-icon slot="icon-only" name="close-outline" />
      </ion-button>
      <app-anime-card [anime]="anime" />
    </ion-content>
  `,
})
export class AnimeDetailModalComponent {
  @Input({ required: true }) anime!: Anime;

  private readonly modalCtrl = inject(ModalController);

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
