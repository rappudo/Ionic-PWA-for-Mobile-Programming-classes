import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  ModalController,
  SearchbarCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

import { normalize } from '../../services/anime-search';

@Component({
  selector: 'app-filter-picker-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filter-picker-modal.component.html',
  styleUrls: ['./filter-picker-modal.component.scss'],
  imports: [
    IonButton,
    IonChip,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonSearchbar,
    IonTitle,
    IonToolbar,
  ],
})
export class FilterPickerModalComponent implements OnInit {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) options: readonly string[] = [];
  @Input() initialSelected: readonly string[] = [];

  private readonly modalCtrl = inject(ModalController);

  readonly query = signal('');
  readonly selected = signal<readonly string[]>([]);

  readonly visibleOptions = computed<readonly string[]>(() => {
    const q = normalize(this.query());
    if (!q) return this.options;
    return this.options.filter((option) => normalize(option).includes(q));
  });

  readonly selectedCount = computed(() => this.selected().length);

  constructor() {
    addIcons({ 'close-outline': closeOutline });
  }

  ngOnInit(): void {
    this.selected.set([...this.initialSelected]);
  }

  isSelected(option: string): boolean {
    return this.selected().includes(option);
  }

  toggle(option: string): void {
    this.selected.update((current) =>
      current.includes(option) ? current.filter((v) => v !== option) : [...current, option],
    );
  }

  onSearch(event: SearchbarCustomEvent): void {
    this.query.set(event.detail.value ?? '');
  }

  reset(): void {
    this.selected.set([]);
  }

  apply(): void {
    void this.modalCtrl.dismiss([...this.selected()], 'apply');
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }
}
