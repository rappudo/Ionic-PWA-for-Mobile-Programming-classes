import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface ShareContent {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class ShareService {
  async share(content: ShareContent): Promise<ShareResult> {
    if (Capacitor.isNativePlatform()) {
      try {
        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: content.title,
            text: content.text,
            url: content.url,
            dialogTitle: content.dialogTitle ?? content.title,
          });
          return 'shared';
        }
      } catch (err) {
        if (this.isCancellation(err)) return 'cancelled';
      }
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: content.title,
          text: content.text,
          url: content.url,
        });
        return 'shared';
      } catch (err) {
        if (this.isCancellation(err)) return 'cancelled';
      }
    }

    if (content.url && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(content.url);
        return 'copied';
      } catch {
        return 'unsupported';
      }
    }

    return 'unsupported';
  }

  private isCancellation(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = (err as { name?: string }).name;
    const message = (err as { message?: string }).message ?? '';
    return name === 'AbortError' || /cancel|abort/i.test(message);
  }
}
