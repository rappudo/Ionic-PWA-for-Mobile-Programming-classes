import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'app-skeleton-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSkeletonText],
  template: `
    <ul class="sk-rows">
      @for (i of slots(); track i) {
        <li class="sk-row">
          @if (avatar()) {
            <div class="sk-row__avatar">
              <ion-skeleton-text [animated]="true" />
            </div>
          }
          <div class="sk-row__lines">
            <ion-skeleton-text class="sk-row__line sk-row__line--title" [animated]="true" />
            <ion-skeleton-text class="sk-row__line sk-row__line--sub" [animated]="true" />
          </div>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sk-rows {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sk-row {
        background: var(--md-surface);
        border: 1px solid var(--md-border);
        border-radius: var(--md-radius);
        padding: 12px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .sk-row__avatar {
        position: relative;
        width: 40px;
        height: 40px;
        flex: 0 0 auto;
        border-radius: 50%;
        overflow: hidden;
        background: var(--md-surface-2);
      }
      .sk-row__avatar ion-skeleton-text {
        --background: var(--md-surface-2);
        position: absolute;
        inset: 0;
        margin: 0;
        border-radius: 50%;
      }
      .sk-row__lines {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sk-row__line {
        --background: var(--md-surface-2);
        margin: 0;
        height: 14px;
        border-radius: 4px;
      }
      .sk-row__line--title {
        width: 50%;
      }
      .sk-row__line--sub {
        width: 30%;
        height: 11px;
      }
    `,
  ],
})
export class SkeletonRowComponent {
  readonly count = input(4);
  readonly avatar = input(true);
  readonly slots = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
