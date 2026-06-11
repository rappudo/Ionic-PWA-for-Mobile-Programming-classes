import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, chevronForwardOutline, trashOutline } from 'ionicons/icons';

import { SkeletonRowComponent } from '../components/skeleton/skeleton-row.component';
import { CustomListsService } from '../services/custom-lists.service';

@Component({
  selector: 'app-lists',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'lists.page.html',
  styleUrls: ['lists.page.scss'],
  imports: [
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    SkeletonRowComponent,
  ],
})
export class ListsPage {
  private readonly listsService = inject(CustomListsService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);

  readonly lists = this.listsService.lists;
  readonly loading = this.listsService.loading;
  readonly newListName = signal('');
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    addIcons({
      'add-outline': addOutline,
      'chevron-forward-outline': chevronForwardOutline,
      'trash-outline': trashOutline,
    });
  }

  onNameInput(value: string | number | null | undefined): void {
    this.newListName.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  async createList(): Promise<void> {
    if (this.creating()) return;
    const name = this.newListName().trim();
    if (!name) return;
    this.creating.set(true);
    this.error.set(null);
    const result = await this.listsService.createList(name);
    this.creating.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.newListName.set('');
  }

  open(listId: string): void {
    void this.router.navigate(['/lists', listId]);
  }

  async onRefresh(event: Event): Promise<void> {
    await this.listsService.refresh();
    (event as RefresherCustomEvent).detail.complete();
  }

  async confirmDelete(listId: string, name: string, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alertCtrl.create({
      header: 'Excluir lista',
      message: `Excluir "${name}"? Não pode ser desfeito.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: () => {
            void this.listsService.deleteList(listId);
          },
        },
      ],
    });
    await alert.present();
  }
}
