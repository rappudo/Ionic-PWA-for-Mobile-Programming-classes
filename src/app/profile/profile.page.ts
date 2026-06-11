import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular/standalone';

import { AvatarCropperModalComponent } from '../components/avatar-cropper-modal/avatar-cropper-modal.component';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  cloudDownloadOutline,
  logOutOutline,
  personCircleOutline,
  statsChartOutline,
  tvOutline,
} from 'ionicons/icons';

import { AuthService } from '../services/auth.service';
import { InstallPromptService } from '../services/install-prompt.service';
import { SupabaseService } from '../services/supabase.service';
import { UserAnimeService } from '../services/user-anime.service';
import { formatWatchTime } from '../services/watch-time';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
    RouterLink,
  ],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService).client;
  private readonly router = inject(Router);
  private readonly userData = inject(UserAnimeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly installPrompt = inject(InstallPromptService);

  readonly canInstall = this.installPrompt.canInstall;
  readonly profile = this.auth.profile;
  readonly username = computed(() => this.profile()?.username ?? '');
  readonly avatarUrl = computed(() => this.profile()?.avatar_url ?? null);
  readonly favoritesCount = this.userData.favoritesCount;
  readonly ratedCount = this.userData.ratedCount;
  readonly statusCounts = this.userData.statusCounts;
  readonly watchTime = computed(() => formatWatchTime(this.userData.watchTimeMinutes()));
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    addIcons({
      'camera-outline': cameraOutline,
      'cloud-download-outline': cloudDownloadOutline,
      'log-out-outline': logOutOutline,
      'person-circle-outline': personCircleOutline,
      'stats-chart-outline': statsChartOutline,
      'tv-outline': tvOutline,
    });
  }

  async installApp(): Promise<void> {
    await this.installPrompt.prompt();
  }

  async onPickFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.error.set(null);
    if (!file.type.startsWith('image/')) {
      this.error.set('Selecione uma imagem.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      this.error.set('Imagem muito grande (máx 2 MB).');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: AvatarCropperModalComponent,
      componentProps: { file },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Blob>();
    if (role !== 'save' || !data) return;
    await this.uploadAvatar(data);
  }

  private async uploadAvatar(blob: Blob): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    this.uploading.set(true);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(path, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });

    if (uploadError) {
      this.uploading.set(false);
      this.error.set('Falha no upload: ' + uploadError.message);
      return;
    }

    const { data: publicData } = this.supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = publicData.publicUrl;

    const { error: updateError } = await this.supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    this.uploading.set(false);

    if (updateError) {
      this.error.set('Falha ao salvar perfil: ' + updateError.message);
      return;
    }

    await this.auth.refreshProfile();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
