import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Role } from '../auth/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  async listAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { email: 'ASC' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
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
      roles: this.authService.isAdminEmail(email) ? [Role.User, Role.Admin] : [Role.User],
    });
    return this.usersRepository.save(user);
  }

  async rename(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOrThrow(id);
    user.name = dto.name.trim();
    user.nameSetByUser = true;
    return this.usersRepository.save(user);
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
}
