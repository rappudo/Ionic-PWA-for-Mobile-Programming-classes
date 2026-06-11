import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SkeletonCoverComponent } from './skeleton-cover.component';

@Component({
  selector: 'app-skeleton-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonCoverComponent],
  template: `
    <div class="sk-grid">
      @for (i of slots(); track i) {
        <app-skeleton-cover />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .sk-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 18px 12px;
        padding: 16px 12px 32px;
      }
      @media (min-width: 768px) {
        .sk-grid {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 22px 16px;
          padding: 22px 20px 40px;
        }
      }
    `,
  ],
})
export class SkeletonGridComponent {
  readonly count = input(12);
  readonly slots = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
