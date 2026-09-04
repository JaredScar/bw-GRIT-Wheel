import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AccessRole } from './access-role.entity';
import { CreateAccessRoleDto } from './dto/create-access-role.dto';
import { UpdateAccessRoleDto } from './dto/update-access-role.dto';
import {
  ALL_PERMISSIONS,
  Permission,
  sanitizePermissions,
} from './permission.enum';

/** Name of the seeded default role. Restrictive on purpose — see SEEDED_ROLES. */
export const DEFAULT_ROLE_NAME = 'Member';
export const FULL_ACCESS_ROLE_NAME = 'Full Access';

/**
 * Seeded once, on the first boot after the access_roles table appears.
 *
 * `Member` is deliberately restrictive: everyone (including accounts that predate this
 * feature) lands on it, so the Hall of Names, the feed, profiles and reactions are all
 * hidden until an admin opts people in. `Full Access` exists so that opting people back in
 * is one dropdown change rather than five checkboxes.
 */
const SEEDED_ROLES: readonly Omit<Partial<AccessRole>, 'id'>[] = [
  {
    name: DEFAULT_ROLE_NAME,
    description: 'Can submit nominations. Everything else is hidden.',
    permissions: [Permission.NominationCreate],
    isDefault: true,
    isSystem: true,
  },
  {
    name: FULL_ACCESS_ROLE_NAME,
    description: 'Can use every non-admin feature.',
    permissions: [...ALL_PERMISSIONS],
    isDefault: false,
    isSystem: true,
  },
];

export interface AccessRoleView {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isDefault: boolean;
  isSystem: boolean;
  /** How many accounts currently resolve through this role. */
  memberCount: number;
}

@Injectable()
export class AccessControlService implements OnModuleInit {
  private readonly logger = new Logger(AccessControlService.name);

  /**
   * The default role is read on every request that has no role of its own, so it's cached.
   * Invalidated by every write in this service; a single app instance is assumed (the same
   * assumption the rest of this app already makes).
   */
  private cachedDefaultRole: AccessRole | null = null;

  constructor(
    @InjectRepository(AccessRole)
    private readonly rolesRepository: Repository<AccessRole>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedSystemRoles();
    await this.backfillUsersWithoutRole();
  }

  /**
   * Creates the seeded roles if they're missing, matched by name. Never touches an existing
   * row, so admins editing `Member`'s permissions don't get overwritten on the next boot.
   */
  private async seedSystemRoles(): Promise<void> {
    for (const seed of SEEDED_ROLES) {
      const existing = await this.rolesRepository.findOne({
        where: { name: seed.name },
      });
      if (existing) continue;

      await this.rolesRepository.save(this.rolesRepository.create(seed));
      this.logger.log(`Seeded access role "${seed.name}"`);
    }
    this.cachedDefaultRole = null;
  }

  /**
   * Points accounts with no role at the default one. Covers rows written before this
   * feature existed as well as any left dangling by a deleted role.
   */
  private async backfillUsersWithoutRole(): Promise<void> {
    const defaultRole = await this.getDefaultRole();
    if (!defaultRole) return;

    const { affected } = await this.usersRepository.update(
      { accessRoleId: IsNull() },
      { accessRoleId: defaultRole.id },
    );

    if (affected) {
      this.logger.log(
        `Assigned ${affected} account(s) to the "${defaultRole.name}" access role`,
      );
    }
  }

  /** Null only if seeding hasn't run yet, which is treated as "no permissions". */
  async getDefaultRole(): Promise<AccessRole | null> {
    if (this.cachedDefaultRole) return this.cachedDefaultRole;

    this.cachedDefaultRole =
      (await this.rolesRepository.findOne({ where: { isDefault: true } })) ??
      (await this.rolesRepository.findOne({
        where: { name: DEFAULT_ROLE_NAME },
      }));

    return this.cachedDefaultRole;
  }

  async getDefaultRoleId(): Promise<string | null> {
    return (await this.getDefaultRole())?.id ?? null;
  }

  /**
   * Resolves the effective permissions for an account. Uses `user.accessRole` when the
   * caller joined it (the hot path, on every authenticated request) and loads it otherwise.
   * An account with no resolvable role falls back to the default one — which covers a role
   * deleted out from under it, and rows predating the backfill.
   */
  async permissionsFor(user: User): Promise<Permission[]> {
    const role = user.accessRole ?? (await this.resolveRole(user.accessRoleId));
    return sanitizePermissions(role?.permissions);
  }

  private async resolveRole(
    id: string | null | undefined,
  ): Promise<AccessRole | null> {
    if (!id) return this.getDefaultRole();
    return (
      (await this.rolesRepository.findOne({ where: { id } })) ??
      this.getDefaultRole()
    );
  }

  async listRoles(): Promise<AccessRoleView[]> {
    const roles = await this.rolesRepository.find({
      order: { isDefault: 'DESC', name: 'ASC' },
    });
    const counts = await this.memberCounts();

    return roles.map((role) => this.toView(role, counts.get(role.id) ?? 0));
  }

  async createRole(dto: CreateAccessRoleDto): Promise<AccessRoleView> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);

    const role = await this.rolesRepository.save(
      this.rolesRepository.create({
        name,
        description: dto.description?.trim() || null,
        permissions: sanitizePermissions(dto.permissions),
        isDefault: false,
        isSystem: false,
      }),
    );

    return this.toView(role, 0);
  }

  async updateRole(
    id: string,
    dto: UpdateAccessRoleDto,
  ): Promise<AccessRoleView> {
    const role = await this.findOrThrow(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name !== role.name) {
        if (role.isSystem) {
          throw new BadRequestException('Built-in roles cannot be renamed');
        }
        await this.assertNameAvailable(name);
        role.name = name;
      }
    }

    if (dto.description !== undefined) {
      role.description = dto.description.trim() || null;
    }

    if (dto.permissions !== undefined) {
      role.permissions = sanitizePermissions(dto.permissions);
    }

    // Promoting a role to default demotes whichever role held it — there is always exactly
    // one, so that new accounts have somewhere unambiguous to land.
    if (dto.isDefault === true && !role.isDefault) {
      await this.rolesRepository.update(
        { isDefault: true },
        { isDefault: false },
      );
      role.isDefault = true;
    } else if (dto.isDefault === false && role.isDefault) {
      throw new BadRequestException(
        'Set another role as the default instead of clearing this one',
      );
    }

    const saved = await this.rolesRepository.save(role);
    this.cachedDefaultRole = null;

    const counts = await this.memberCounts();
    return this.toView(saved, counts.get(saved.id) ?? 0);
  }

  /** Members of the deleted role are moved to the default role rather than left dangling. */
  async deleteRole(id: string): Promise<void> {
    const role = await this.findOrThrow(id);

    if (role.isSystem) {
      throw new BadRequestException('Built-in roles cannot be deleted');
    }
    if (role.isDefault) {
      throw new BadRequestException(
        'Set another role as the default before deleting this one',
      );
    }

    const defaultRole = await this.getDefaultRole();
    if (!defaultRole) {
      throw new BadRequestException(
        'No default role is configured to reassign members to',
      );
    }

    await this.usersRepository.update(
      { accessRoleId: id },
      { accessRoleId: defaultRole.id },
    );
    await this.rolesRepository.remove(role);
    this.cachedDefaultRole = null;
  }

  /** Throws if the id doesn't exist, so callers can validate an assignment up front. */
  async assertRoleExists(id: string): Promise<AccessRole> {
    return this.findOrThrow(id);
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const clash = await this.rolesRepository.findOne({ where: { name } });
    if (clash) {
      throw new ConflictException('A role with that name already exists');
    }
  }

  private async findOrThrow(id: string): Promise<AccessRole> {
    const role = await this.rolesRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private async memberCounts(): Promise<Map<string, number>> {
    const rows = await this.usersRepository
      .createQueryBuilder('user')
      .select('user.accessRoleId', 'roleId')
      .addSelect('COUNT(*)', 'count')
      .where({ accessRoleId: Not(IsNull()) })
      .groupBy('user.accessRoleId')
      .getRawMany<{ roleId: string; count: string }>();

    return new Map(rows.map((row) => [row.roleId, Number(row.count)]));
  }

  private toView(role: AccessRole, memberCount: number): AccessRoleView {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: sanitizePermissions(role.permissions),
      isDefault: role.isDefault,
      isSystem: role.isSystem,
      memberCount,
    };
  }
}
