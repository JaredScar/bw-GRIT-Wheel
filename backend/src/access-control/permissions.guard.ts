import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { SessionUser } from '../auth/session-user';
import { Permission, PERMISSION_CATALOG } from './permission.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';

/**
 * Runs after JwtAuthGuard (which resolves request.user, including its permissions).
 * Routes without a @RequirePermissions() decorator are left alone, so this only ever
 * narrows access.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: SessionUser }>();
    const user = request.user;

    // Admins are intentionally exempt: access roles describe what non-admins may do, and
    // an admin who locked themselves out of the app would have no way back in.
    if (user?.isAdmin) {
      return true;
    }

    const held = new Set(user?.permissions ?? []);
    const missing = required.filter((permission) => !held.has(permission));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Your access role does not allow this: ${missing.map(describe).join(', ')}`,
      );
    }

    return true;
  }
}

function describe(permission: Permission): string {
  return (
    PERMISSION_CATALOG.find((entry) => entry.key === permission)?.label ??
    permission
  );
}
