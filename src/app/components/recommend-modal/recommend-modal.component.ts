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
import { checkmarkOutline, closeOutline, personCircleOutline } from 'ionicons/icons';

import { Profile } from '../../models/profile';
import { FriendsService } from '../../services/friends.service';
import { RecommendationsInboxService } from '../../services/recommendations-inbox.service';

@Component({
  selector: 'app-recommend-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'recommend-modal.component.html',
  styleUrls: ['recommend-modal.component.scss'],
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
export class RecommendModalComponent {
  private readonly friends = inject(FriendsService);
  private readonly inbox = inject(RecommendationsInboxService);
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) animeId!: string;
  @Input() animeTitle: string = '';

  readonly friendList = computed(() => this.friends.accepted());
  readonly message = signal('');
  readonly sending = signal<string | null>(null);
  readonly justSent = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);

  readonly alreadySent = computed(() => this.inbox.recipientsFor(this.animeId));

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
      'person-circle-outline': personCircleOutline,
    });
  }

  onMessageInput(value: string | number | null | undefined): void {
    this.message.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  alreadyOrJustSent(profileId: string): boolean {
    return this.alreadySent().has(profileId) || this.justSent().has(profileId);
  }

  async send(profile: Profile): Promise<void> {
    if (this.alreadyOrJustSent(profile.id)) return;
    if (this.sending()) return;
    this.error.set(null);
    this.sending.set(profile.id);
    const result = await this.inbox.sendRecommendation(
      profile.id,
      this.animeId,
      this.message() || null,
    );
    this.sending.set(null);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    const next = new Set(this.justSent());
    next.add(profile.id);
    this.justSent.set(next);
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
