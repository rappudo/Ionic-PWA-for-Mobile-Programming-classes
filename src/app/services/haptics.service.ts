import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HapticsService {
  private get supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }

  light(): void {
    if (this.supported) navigator.vibrate(12);
  }

  medium(): void {
    if (this.supported) navigator.vibrate(22);
  }

  success(): void {
    if (this.supported) navigator.vibrate([15, 35, 15]);
  }

  warning(): void {
    if (this.supported) navigator.vibrate([25, 40, 25]);
  }
}
