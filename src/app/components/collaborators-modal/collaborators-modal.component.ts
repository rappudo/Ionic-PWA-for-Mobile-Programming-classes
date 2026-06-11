import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
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
import {
  closeOutline,
  personAddOutline,
  personCircleOutline,
  trashOutline,
} from 'ionicons/icons';

import { CollaboratorView, CustomListsService } from '../../services/custom-lists.service';

@Component({
  selector: 'app-collaborators-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'collaborators-modal.component.html',
  styleUrls: ['collaborators-modal.component.scss'],
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
export class CollaboratorsModalComponent implements OnInit {
  private readonly listsService = inject(CustomListsService);
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) listId!: string;

  readonly collaborators = signal<CollaboratorView[]>([]);
  readonly loading = signal(true);
  readonly inviteName = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    addIcons({
      'close-outline': closeOutline,
      'person-add-outline': personAddOutline,
      'person-circle-outline': personCircleOutline,
      'trash-outline': trashOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  onInviteInput(value: string | number | null | undefined): void {
    this.inviteName.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  async invite(): Promise<void> {
    if (this.busy()) return;
    const username = this.inviteName().trim();
    if (!username) return;
    this.busy.set(true);
    this.error.set(null);
    const result = await this.listsService.addCollaborator(this.listId, username);
    this.busy.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.inviteName.set('');
    await this.reload();
  }

  async remove(userId: string): Promise<void> {
    const previous = this.collaborators();
    this.collaborators.set(previous.filter((c) => c.user_id !== userId));
    const ok = await this.listsService.removeCollaborator(this.listId, userId);
    if (!ok) this.collaborators.set(previous);
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.collaborators.set(await this.listsService.listCollaborators(this.listId));
    this.loading.set(false);
  }
}
