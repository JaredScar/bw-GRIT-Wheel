import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionUser } from '../auth/session-user';
import { Permission } from './permission.enum';
import { PermissionsGuard } from './permissions.guard';

function createContext(user?: Partial<SessionUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function createGuard(required: Permission[] | undefined): PermissionsGuard {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
  return new PermissionsGuard(reflector as unknown as Reflector);
}

describe('PermissionsGuard', () => {
  it('allows routes with no @RequirePermissions() decorator through untouched', () => {
    const guard = createGuard(undefined);

    expect(guard.canActivate(createContext({ permissions: [] }))).toBe(true);
  });

  it('allows a route decorated with an empty permission list', () => {
    const guard = createGuard([]);

    expect(guard.canActivate(createContext({ permissions: [] }))).toBe(true);
  });

  it('allows a user holding the required permission', () => {
    const guard = createGuard([Permission.HallView]);

    expect(
      guard.canActivate(createContext({ permissions: [Permission.HallView] })),
    ).toBe(true);
  });

  it('rejects a user whose access role lacks the permission', () => {
    const guard = createGuard([Permission.HallView]);
    const context = () =>
      createContext({ permissions: [Permission.NominationCreate] });

    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
    // The message names the capability, not the raw permission key.
    expect(() => guard.canActivate(context())).toThrow(
      'View the GRIT Hall of Names',
    );
  });

  it('requires every listed permission, not just one of them', () => {
    const guard = createGuard([
      Permission.NominationView,
      Permission.NominationReact,
    ]);

    expect(() =>
      guard.canActivate(
        createContext({ permissions: [Permission.NominationView] }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('lets admins through regardless of their permissions', () => {
    const guard = createGuard([Permission.HallView]);

    expect(
      guard.canActivate(createContext({ isAdmin: true, permissions: [] })),
    ).toBe(true);
  });

  it('rejects rather than crashing when permissions are missing from the session', () => {
    const guard = createGuard([Permission.HallView]);

    expect(() =>
      guard.canActivate(createContext({ permissions: undefined })),
    ).toThrow(ForbiddenException);
  });

  it('rejects when there is no user on the request at all', () => {
    const guard = createGuard([Permission.HallView]);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
