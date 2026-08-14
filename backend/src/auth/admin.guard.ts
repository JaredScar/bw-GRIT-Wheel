import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SessionUser } from './session-user';

/**
 * Runs after the global JwtAuthGuard (which populates request.user); only allows
 * through users whose email is on the ADMIN_EMAILS allow-list.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!request.user?.isAdmin) {
      throw new ForbiddenException('Admin access is required');
    }
    return true;
  }
}
