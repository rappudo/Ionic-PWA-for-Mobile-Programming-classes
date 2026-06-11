import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonSpinner,
} from '@ionic/angular/standalone';

import { AuthService } from '../services/auth.service';
import { ThemeService } from '../services/theme.service';

type Mode = 'signin' | 'signup';

@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'auth.page.html',
  styleUrls: ['auth.page.scss'],
  imports: [FormsModule, IonButton, IonContent, IonInput, IonItem, IonSpinner],
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;
  readonly mode = signal<Mode>('signin');
  readonly username = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    const result =
      this.mode() === 'signup'
        ? await this.auth.signUp(this.username(), this.password())
        : await this.auth.signIn(this.username(), this.password());
    this.loading.set(false);
    if (!result.ok) {
      this.error.set(result.message);
      return;
    }
    await this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  onUsernameInput(value: string | number | null | undefined): void {
    this.username.set(typeof value === 'string' ? value : String(value ?? ''));
  }

  onPasswordInput(value: string | number | null | undefined): void {
    this.password.set(typeof value === 'string' ? value : String(value ?? ''));
  }
}
