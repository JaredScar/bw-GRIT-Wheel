import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { Role } from './role.enum';

const ADMIN_EMAIL = 'admin@bitwarden.com';

function createService(seedUsers: Partial<User>[] = []) {
  // Held by reference, not copied, so tests can assert on mutations the service makes.
  const users = seedUsers as User[];

  const repository = {
    find: jest.fn().mockImplementation(({ where }: { where: { email: { _value: string[] } } }) => {
      const wanted: string[] = where.email._value ?? [];
      return Promise.resolve(users.filter((u) => wanted.includes(u.email)));
    }),
    findOne: jest.fn().mockImplementation(({ where }: { where: { email: string } }) => {
      return Promise.resolve(users.find((u) => u.email === where.email) ?? null);
    }),
    create: jest.fn((data: Partial<User>) => ({ ...data }) as User),
    save: jest.fn((entity: User | User[]) => Promise.resolve(entity)),
  };

  const service = new AuthService(
    repository as unknown as Repository<User>,
    { signAsync: jest.fn().mockResolvedValue('signed.jwt') } as unknown as JwtService,
    {
      get: (key: string, fallback?: string) => (key === 'ADMIN_EMAILS' ? ADMIN_EMAIL : fallback),
    } as unknown as ConfigService,
  );

  return { service, repository, users };
}

describe('AuthService roles', () => {
  describe('signInWithGoogleProfile', () => {
    it('seeds a brand new allow-listed user with the admin role', async () => {
      const { service, repository } = createService();

      await service.signInWithGoogleProfile({ email: ADMIN_EMAIL, name: 'Admin', picture: null });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [Role.User, Role.Admin] }),
      );
    });

    it('seeds a brand new ordinary user with only the user role', async () => {
      const { service, repository } = createService();

      await service.signInWithGoogleProfile({
        email: 'someone@bitwarden.com',
        name: 'Someone',
        picture: null,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ roles: [Role.User] }),
      );
    });

    it('does not overwrite the roles of an existing user on sign-in', async () => {
      const existing = {
        id: '1',
        email: 'promoted@bitwarden.com',
        name: 'Promoted',
        roles: [Role.User, Role.Admin],
      };
      const { service } = createService([existing]);

      const { user } = await service.signInWithGoogleProfile({
        email: 'promoted@bitwarden.com',
        name: 'Promoted',
        picture: null,
      });

      expect(user.roles).toEqual([Role.User, Role.Admin]);
    });

    it('refreshes the stored picture URL on every sign-in', async () => {
      const existing = {
        id: '1',
        email: 'someone@bitwarden.com',
        name: 'Someone',
        pictureUrl: 'https://lh3.googleusercontent.com/a/old=s96-c',
        roles: [Role.User],
      } as User;
      const { service } = createService([existing]);

      const { user } = await service.signInWithGoogleProfile({
        email: 'someone@bitwarden.com',
        name: 'Someone',
        picture: 'https://lh3.googleusercontent.com/a/new=s96-c',
      });

      expect(user.pictureUrl).toBe('https://lh3.googleusercontent.com/a/new=s96-c');
    });
  });

  describe('onModuleInit', () => {
    it('grants admin to an allow-listed user who predates the roles column', async () => {
      const legacy = { id: '1', email: ADMIN_EMAIL, name: null } as User;
      const { service } = createService([legacy]);

      await service.onModuleInit();

      expect(legacy.roles).toEqual([Role.User, Role.Admin]);
    });

    it('leaves an allow-listed user who is already an admin untouched', async () => {
      const alreadyAdmin = {
        id: '1',
        email: ADMIN_EMAIL,
        name: null,
        roles: [Role.User, Role.Admin],
      } as User;
      const { service, repository } = createService([alreadyAdmin]);

      await service.onModuleInit();

      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('toSessionUser', () => {
    it('derives isAdmin from the persisted roles, not the env var', () => {
      const { service } = createService();

      const admin = service.toSessionUser({
        id: '1',
        email: 'someone@bitwarden.com',
        name: 'Someone',
        roles: [Role.User, Role.Admin],
      } as User);
      expect(admin.isAdmin).toBe(true);
      expect(admin.roles).toEqual([Role.User, Role.Admin]);

      // On the allow-list but not yet promoted in the database.
      const notYetPromoted = service.toSessionUser({
        id: '2',
        email: ADMIN_EMAIL,
        name: 'Admin',
        roles: [Role.User],
      } as User);
      expect(notYetPromoted.isAdmin).toBe(false);
    });

    it('falls back to the user role for legacy rows with no roles', () => {
      const { service } = createService();

      const session = service.toSessionUser({
        id: '1',
        email: 'legacy@bitwarden.com',
        name: null,
      } as User);

      expect(session.roles).toEqual([Role.User]);
      expect(session.isAdmin).toBe(false);
    });
  });
});
