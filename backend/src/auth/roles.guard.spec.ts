import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './role.enum';
import { RolesGuard } from './roles.guard';
import { SessionUser } from './session-user';

function createContext(user?: Partial<SessionUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function createGuard(requiredRoles: Role[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) };
  return new RolesGuard(reflector as unknown as Reflector);
}

describe('RolesGuard', () => {
  it('allows routes with no @Roles() decorator through untouched', () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createContext({ roles: [Role.User] }))).toBe(true);
  });

  it('allows a route decorated with an empty role list', () => {
    const guard = createGuard([]);

    expect(guard.canActivate(createContext({ roles: [Role.User] }))).toBe(true);
  });

  it('allows an admin into an admin-only route', () => {
    const guard = createGuard([Role.Admin]);

    expect(guard.canActivate(createContext({ roles: [Role.User, Role.Admin] }))).toBe(true);
  });

  it('rejects a non-admin from an admin-only route', () => {
    const guard = createGuard([Role.Admin]);

    expect(() => guard.canActivate(createContext({ roles: [Role.User] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(createContext({ roles: [Role.User] }))).toThrow(
      'Admin access is required',
    );
  });

  it('rejects rather than crashing when roles are missing (legacy rows)', () => {
    const guard = createGuard([Role.Admin]);

    expect(() => guard.canActivate(createContext({ roles: undefined }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no user on the request at all', () => {
    const guard = createGuard([Role.Admin]);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });
});
