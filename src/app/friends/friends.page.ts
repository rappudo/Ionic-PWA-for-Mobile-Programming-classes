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
import {
  checkmarkOutline,
  closeOutline,
  personAddOutline,
  personCircleOutline,
} from 'ionicons/icons';

import { SkeletonRowComponent } from '../components/skeleton/skeleton-row.component';
import { Friendship } from '../models/friendship';
import { Profile } from '../models/profile';
import { AuthService } from '../services/auth.service';
import { FriendsService } from '../services/friends.service';
import { MatchService } from '../services/match.service';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-friends',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'friends.page.html',
  styleUrls: ['friends.page.scss'],
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
export class FriendsPage {
  private readonly friendsService = inject(FriendsService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly supabase = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly matchService = inject(MatchService);

  readonly accepted = this.friendsService.accepted;
  readonly pendingIncoming = this.friendsService.pendingIncoming;
  readonly pendingOutgoing = this.friendsService.pendingOutgoing;
  readonly loading = this.friendsService.loading;

  readonly newFriendId = signal('');
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly suggestions = signal<Profile[]>([]);
  readonly searching = signal(false);
  readonly suggestionsOpen = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSearchToken = 0;

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
      'person-add-outline': personAddOutline,
      'person-circle-outline': personCircleOutline,
    });
  }

  onUsernameInput(value: string | number | null | undefined): void {
    const next = typeof value === 'string' ? value : String(value ?? '');
    this.newFriendId.set(next);
    this.suggestionsOpen.set(true);
    this.scheduleSearch(next);
  }

  onSearchFocus(): void {
    if (this.newFriendId().trim().length >= 2) this.suggestionsOpen.set(true);
  }

  onSearchBlur(): void {
    setTimeout(() => this.suggestionsOpen.set(false), 150);
  }

  relationshipFor(profileId: string): { label: string; tone: 'friend' | 'sent' | 'received' } | null {
    if (this.accepted().some((v) => v.other.id === profileId)) {
      return { label: 'Amigo', tone: 'friend' };
    }
    if (this.pendingOutgoing().some((v) => v.other.id === profileId)) {
      return { label: 'Enviado', tone: 'sent' };
    }
    if (this.pendingIncoming().some((v) => v.other.id === profileId)) {
      return { label: 'Recebido', tone: 'received' };
    }
    return null;
  }

  selectSuggestion(profile: Profile): void {
    this.suggestionsOpen.set(false);
    void this.router.navigate(['/users', profile.username]);
  }

  private scheduleSearch(prefix: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const trimmed = prefix.trim().toLowerCase();
    if (trimmed.length < 2) {
      this.suggestions.set([]);
      this.searching.set(false);
      return;
    }
    this.searchTimer = setTimeout(() => void this.runSearch(trimmed), 200);
  }

  private async runSearch(prefix: string): Promise<void> {
    const token = ++this.currentSearchToken;
    this.searching.set(true);
    const myId = this.auth.user()?.id ?? '';
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .ilike('username', `${prefix}%`)
      .neq('id', myId)
      .order('username', { ascending: true })
      .limit(8);
    if (token !== this.currentSearchToken) return;
    this.suggestions.set((data ?? []) as Profile[]);
    this.searching.set(false);
  }

  async sendRequest(): Promise<void> {
    if (this.sending()) return;
    this.error.set(null);
    this.info.set(null);
    this.sending.set(true);
    const result = await this.friendsService.sendRequest(this.newFriendId());
    this.sending.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    this.info.set('Pedido enviado.');
    this.newFriendId.set('');
  }

  async accept(friendship: Friendship): Promise<void> {
    const result = await this.friendsService.accept(friendship);
    if (!result.ok) this.error.set(result.message);
  }

  async reject(friendship: Friendship, otherUsername: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Recusar pedido',
      message: `Recusar pedido de @${otherUsername}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Recusar',
          role: 'destructive',
          handler: () => {
            void this.friendsService.remove(friendship);
          },
        },
      ],
    });
    await alert.present();
  }

  async cancelOutgoing(friendship: Friendship, otherUsername: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Cancelar pedido',
      message: `Cancelar pedido para @${otherUsername}?`,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        {
          text: 'Cancelar pedido',
          role: 'destructive',
          handler: () => {
            void this.friendsService.remove(friendship);
          },
        },
      ],
    });
    await alert.present();
  }

  async unfriend(friendship: Friendship, otherUsername: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Remover amizade',
      message: `Remover @${otherUsername} dos seus amigos?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Remover',
          role: 'destructive',
          handler: () => {
            void this.friendsService.remove(friendship);
          },
        },
      ],
    });
    await alert.present();
  }

  openProfile(username: string): void {
    void this.router.navigate(['/users', username]);
  }

  async onRefresh(event: Event): Promise<void> {
    await this.friendsService.refresh();
    (event as RefresherCustomEvent).detail.complete();
  }

  matchScore(userId: string): number | null {
    return this.matchService.matchWith(userId).score;
  }
}
