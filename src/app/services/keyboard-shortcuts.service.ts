import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';

import { KeyboardHelpModalComponent } from '../components/keyboard-help-modal/keyboard-help-modal.component';
import { AuthService } from './auth.service';
import { ThemeService } from './theme.service';

const CHORD_TIMEOUT_MS = 1000;
const EDITABLE_TAGS = new Set([
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'ION-INPUT',
  'ION-TEXTAREA',
  'ION-SEARCHBAR',
]);

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);

  private chord: string | null = null;
  private chordTimer: ReturnType<typeof setTimeout> | null = null;
  private helpOpen = false;
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    document.addEventListener('keydown', this.handleKeyDown);
    this.initialized = true;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.isTyping(e)) {
      if (e.key === 'Escape') {
        (e.target as HTMLElement | null)?.blur();
      }
      return;
    }

    if (this.chord) {
      this.handleChord(e);
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      this.focusSearch();
      return;
    }
    if (e.key === '?') {
      e.preventDefault();
      void this.openHelp();
      return;
    }
    if (!this.auth.isAuthenticated()) return;

    if (e.key === 't' || e.key === 'T') {
      this.themeService.toggle();
      return;
    }
    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      this.startChord('g');
    }
  };

  private handleChord(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const route: string | null = (() => {
      switch (key) {
        case 'h':
          return '/home';
        case 'l':
          return '/lists';
        case 'f':
          return '/feed';
        case 'a':
          return '/friends';
        case 'r':
          return '/recommendations';
        case 'u':
          return '/surprise';
        case 'p':
          return '/profile';
        case 's':
          return '/stats';
        default:
          return null;
      }
    })();

    if (route) {
      e.preventDefault();
      void this.router.navigateByUrl(route);
    }
    this.clearChord();
  }

  private startChord(key: string): void {
    this.chord = key;
    if (this.chordTimer) clearTimeout(this.chordTimer);
    this.chordTimer = setTimeout(() => this.clearChord(), CHORD_TIMEOUT_MS);
  }

  private clearChord(): void {
    this.chord = null;
    if (this.chordTimer) {
      clearTimeout(this.chordTimer);
      this.chordTimer = null;
    }
  }

  private isTyping(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    if (target.isContentEditable) return true;
    if (EDITABLE_TAGS.has(target.tagName)) return true;
    if (target.closest('ion-input, ion-textarea, ion-searchbar, input, textarea')) return true;
    return false;
  }

  private focusSearch(): void {
    const searchbar = document.querySelector<HTMLIonSearchbarElement>('ion-searchbar');
    if (searchbar) void searchbar.setFocus();
  }

  private async openHelp(): Promise<void> {
    if (this.helpOpen) return;
    this.helpOpen = true;
    const modal = await this.modalCtrl.create({
      component: KeyboardHelpModalComponent,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.helpOpen = false;
  }
}
