import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, checkmarkOutline, closeOutline } from 'ionicons/icons';

import { CustomListsService } from '../../services/custom-lists.service';

@Component({
  selector: 'app-add-to-list-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'add-to-list-modal.component.html',
  styleUrls: ['add-to-list-modal.component.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonTitle,
    IonToolbar,
  ],
})
export class AddToListModalComponent {
  private readonly listsService = inject(CustomListsService);
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) animeId!: string;
  @Input() animeTitle: string = '';

  readonly lists = this.listsService.lists;
  readonly newListName = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal<string | null>(null);

  readonly membership = computed(() => {
    const set = new Set<string>();
    for (const list of this.lists()) {
      if (list.anime_ids.includes(this.animeId)) set.add(list.id);
    }
    return set;
  });

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
    });
  }

  isMember(listId: string): boolean {
    return this.membership().has(listId);
  }

  async toggle(listId: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(listId);
    if (this.isMember(listId)) {
      await this.listsService.removeAnime(listId, this.animeId);
    } else {
      await this.listsService.addAnime(listId, this.animeId);
    }
    this.busy.set(null);
  }

  onNewListInput(value: string | number | null | undefined): void {
    this.newListName.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  async createAndAdd(): Promise<void> {
    if (this.creating()) return;
    const name = this.newListName().trim();
    if (!name) return;
    this.creating.set(true);
    this.error.set(null);
    const result = await this.listsService.createList(name);
    if (!result.ok) {
      this.creating.set(false);
      this.error.set(result.message);
      return;
    }
    await this.listsService.addAnime(result.list.id, this.animeId);
    this.newListName.set('');
    this.creating.set(false);
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
