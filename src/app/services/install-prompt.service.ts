import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  readonly canInstall = signal(false);
  readonly installed = signal(this.detectStandalone());

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.installed.set(true);
    });
  }

  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const ev = this.deferredPrompt;
    if (!ev) return 'unavailable';
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    return outcome;
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const mql = window.matchMedia?.('(display-mode: standalone)');
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return Boolean(mql?.matches || iosStandalone);
  }
}
