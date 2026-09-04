import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';
import { AuthService } from '../auth/auth.service';
import { Role } from '../auth/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

/**
 * Admin-facing account shape. Explicit rather than the raw entity so the assigned access
 * role reads as two flat fields, and so internal columns (`pictureUrl`, `nameSetByUser`)
 * stay out of the payload.
 */
export interface ManagedUserView {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  accessRoleId: string | null;
  accessRoleName: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly authService: AuthService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async listAll(): Promise<ManagedUserView[]> {
    const users = await this.usersRepository.find({
      order: { email: 'ASC' },
      relations: { accessRole: true },
    });
    return users.map((user) => this.toView(user));
  }

  async create(dto: CreateUserDto): Promise<ManagedUserView> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    const name = dto.name?.trim() || null;
    const user = this.usersRepository.create({
      email,
      name,
      // Set so this admin-chosen name isn't silently overwritten on the person's first Google sign-in.
      nameSetByUser: !!name,
      roles: this.authService.isAdminEmail(email)
        ? [Role.User, Role.Admin]
        : [Role.User],
      accessRoleId: await this.accessControlService.getDefaultRoleId(),
    });
    const saved = await this.usersRepository.save(user);

    return this.findViewOrThrow(saved.id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<ManagedUserView> {
    const user = await this.findOrThrow(id);

    if (dto.name !== undefined) {
      user.name = dto.name.trim();
      user.nameSetByUser = true;
    }

    if (dto.accessRoleId !== undefined) {
      // Validated up front so an unknown id is a 404 rather than a foreign-key error.
      await this.accessControlService.assertRoleExists(dto.accessRoleId);
      user.accessRoleId = dto.accessRoleId;
    }

    await this.usersRepository.save(user);

    return this.findViewOrThrow(id);
  }

  /**
   * Deletes only the account row (login identity, name, roles). Nominations/upvotes are
   * free-text-by-email historical records independent of `users`, and deliberately left
   * intact so past round results and analytics aren't altered by an account removal.
   */
  async remove(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.findOrThrow(id);
    await this.usersRepository.remove(user);
  }

  private async findOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Re-reads with the role joined, so the response always carries the role's name. */
  private async findViewOrThrow(id: string): Promise<ManagedUserView> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { accessRole: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toView(user);
  }

  private toView(user: User): ManagedUserView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles?.length ? user.roles : [Role.User],
      accessRoleId: user.accessRoleId,
      accessRoleName: user.accessRole?.name ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }
}
