import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '../models/permission';
import { AuthService } from '../services/auth.service';

/**
 * Pages a signed-in account might land on, in preference order, each with the permission
 * that unlocks it. `/` and the wildcard route both redirect to `/nominate`, so a restricted
 * account bounces from there through this list until it reaches a page it may actually use.
 */
const LANDING_CANDIDATES: readonly { path: string; permission: Permission }[] = [
  { path: '/nominate', permission: 'nomination:create' },
  { path: '/nominations', permission: 'nomination:view' },
  { path: '/rounds', permission: 'hall:view' },
];

export const NO_ACCESS_PATH = '/no-access';

/**
 * The best page this account can reach. Never returns a page the account lacks permission
 * for, which is what stops a denied navigation from bouncing in a loop.
 */
function landingPathFor(authService: AuthService): string {
  return (
    LANDING_CANDIDATES.find((candidate) => authService.can(candidate.permission))?.path ??
    NO_ACCESS_PATH
  );
}

/**
 * Gates a route on a single permission. Denials redirect to the account's landing page
 * rather than showing an error — the matching nav link is hidden too, so arriving here
 * means someone typed the URL or followed a stale link.
 */
export function requirePermission(permission: Permission): CanActivateFn {
  return async () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.ready;

    if (!authService.currentUser()) {
      return router.createUrlTree(['/login']);
    }

    return authService.can(permission) ? true : router.parseUrl(landingPathFor(authService));
  };
}
