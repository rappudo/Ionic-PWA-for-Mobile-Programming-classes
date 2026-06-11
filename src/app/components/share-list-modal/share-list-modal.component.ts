import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToggle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline, copyOutline, shareSocialOutline } from 'ionicons/icons';

import { CustomListsService } from '../../services/custom-lists.service';
import { ShareService } from '../../services/share.service';

@Component({
  selector: 'app-share-list-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'share-list-modal.component.html',
  styleUrls: ['share-list-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToggle,
    IonToolbar,
  ],
})
export class ShareListModalComponent {
  private readonly listsService = inject(CustomListsService);
  private readonly modalCtrl = inject(ModalController);
  private readonly shareService = inject(ShareService);

  @Input({ required: true }) listId!: string;

  readonly list = computed(() => this.listsService.listById(this.listId));
  readonly isPublic = computed(() => this.list()?.is_public ?? false);
  readonly url = computed(() => {
    const list = this.list();
    if (!list) return '';
    return `${window.location.origin}/share/lists/${list.share_token}`;
  });

  readonly copied = signal(false);
  readonly busy = signal(false);
  readonly hasNativeShare =
    Capacitor.isNativePlatform() ||
    (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
      'copy-outline': copyOutline,
      'share-social-outline': shareSocialOutline,
    });
  }

  async togglePublic(event: Event): Promise<void> {
    const next = (event as CustomEvent<{ checked: boolean }>).detail.checked;
    if (this.busy()) return;
    this.busy.set(true);
    await this.listsService.setPublic(this.listId, next);
    this.busy.set(false);
  }

  async copyUrl(): Promise<void> {
    const url = this.url();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.copied.set(false);
    }
  }

  async share(): Promise<void> {
    const url = this.url();
    const list = this.list();
    if (!url || !list) return;
    const result = await this.shareService.share({
      title: list.name,
      text: `Confere essa lista de animes: ${list.name}`,
      url,
      dialogTitle: 'Compartilhar lista',
    });
    if (result === 'copied') {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
