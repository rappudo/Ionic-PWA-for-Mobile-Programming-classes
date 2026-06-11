import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-skeleton-cover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSkeletonText],
  template: `
    <div class="sk-cover">
      <div class="sk-cover__media">
        <ion-skeleton-text [animated]="true" />
      </div>
      <ion-skeleton-text class="sk-cover__title" [animated]="true" />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sk-cover {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sk-cover__media {
        position: relative;
        width: 100%;
        aspect-ratio: 2 / 3;
        border-radius: var(--md-radius, 6px);
        overflow: hidden;
        background: var(--md-surface-2);
      }
      .sk-cover__media ion-skeleton-text {
        --background: var(--md-surface-2);
        --background-rgb: var(--md-surface-2-rgb, 47, 47, 53);
        position: absolute;
        inset: 0;
        margin: 0;
        border-radius: 0;
        width: 100%;
        height: 100%;
      }
      .sk-cover__title {
        --background: var(--md-surface-2);
        height: 14px;
        width: 80%;
        margin: 0;
        border-radius: 4px;
      }
    `,
  ],
})
export class SkeletonCoverComponent {
  readonly count = input(1);
}
