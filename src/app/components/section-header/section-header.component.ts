import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowForward } from 'ionicons/icons';

/**
 * Consistent heading for content sections and rails: an optional eyebrow,
 * a title, and an optional trailing action ("ver tudo"). Presentational only —
 * emits `action` for the host to handle.
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sh">
      <div class="sh__text">
        @if (eyebrow()) {
          <span class="sh__eyebrow">{{ eyebrow() }}</span>
        }
        <h2 class="sh__title">{{ title() }}</h2>
      </div>
      @if (actionLabel()) {
        <button type="button" class="sh__action" (click)="action.emit()">
          {{ actionLabel() }}
          <ion-icon name="arrow-forward" aria-hidden="true" />
        </button>
      }
    </header>
  `,
  styleUrls: ['./section-header.component.scss'],
  imports: [IonIcon],
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  readonly eyebrow = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();

  constructor() {
    addIcons({ 'arrow-forward': arrowForward });
  }
}
