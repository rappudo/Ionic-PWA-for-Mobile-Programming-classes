import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

async function waitForReady(auth: AuthService): Promise<void> {
  if (auth.ready()) return;
  await new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (auth.ready() || Date.now() - start > 5000) {
        resolve();
        return;
      }
      setTimeout(tick, 20);
    };
    tick();
  });
}

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForReady(auth);
  if (auth.isAuthenticated()) return true;
  return router.parseUrl('/auth');
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await waitForReady(auth);
  if (!auth.isAuthenticated()) return true;
  return router.parseUrl('/home');
};
