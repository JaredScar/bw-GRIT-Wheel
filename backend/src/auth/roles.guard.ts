import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from './role.enum';
import { ROLES_KEY } from './roles.decorator';
import { SessionUser } from './session-user';

/**
 * Runs after the global JwtAuthGuard (which populates request.user). Routes without a
 * @Roles() decorator are left alone, so this only ever narrows access, never widens it.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const roles = request.user?.roles ?? [];

    if (!requiredRoles.some((role) => roles.includes(role))) {
      throw new ForbiddenException(
        requiredRoles.includes(Role.Admin)
          ? 'Admin access is required'
          : 'You do not have access to this resource',
      );
    }

    return true;
  }
}
