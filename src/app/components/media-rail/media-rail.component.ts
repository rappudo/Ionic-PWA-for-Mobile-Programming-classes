import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward } from 'ionicons/icons';

import { Anime } from '../../models/anime';
import { AnimeCoverComponent } from '../anime-cover/anime-cover.component';
import { SectionHeaderComponent } from '../section-header/section-header.component';

/**
 * Horizontal, scroll-snapping rail of anime covers (Crunchyroll/Netflix style).
 * Renders nothing when empty. On wide screens, hover reveals scroll buttons.
 */
@Component({
  selector: 'app-media-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './media-rail.component.html',
  styleUrls: ['./media-rail.component.scss'],
  imports: [IonIcon, AnimeCoverComponent, SectionHeaderComponent],
})
export class MediaRailComponent {
  readonly title = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly animes = input.required<readonly Anime[]>();

  readonly select = output<Anime>();
  readonly action = output<void>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  scrollBy(direction: 1 | -1): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  constructor() {
    addIcons({ 'chevron-back': chevronBack, 'chevron-forward': chevronForward });
  }
}
