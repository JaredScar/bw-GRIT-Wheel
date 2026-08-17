import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { GoogleProfile } from './google-oauth.service';
import { Role } from './role.enum';
import { SessionUser } from './session-user';

const SESSION_TTL = '30d';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.grantAdminToConfiguredEmails();
  }

  get sessionTtl(): string {
    return SESSION_TTL;
  }

  private get adminEmails(): Set<string> {
    const raw = this.configService.get<string>('ADMIN_EMAILS', '');
    return new Set(
      raw
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  isAdminEmail(email: string): boolean {
    return this.adminEmails.has(email.trim().toLowerCase());
  }

  /**
   * Additively grants the admin role to everyone on the ADMIN_EMAILS allow-list. Runs on
   * boot so that (a) users who predate the roles column aren't stranded on the column's
   * `user` default, and (b) there is always a way to recover admin access via config.
   *
   * Only ever adds roles, so admins promoted directly in the database are left intact.
   * The flip side: demoting someone on the allow-list means removing them from it, since
   * a database-only demotion would be undone on the next boot.
   */
  private async grantAdminToConfiguredEmails(): Promise<void> {
    const emails = [...this.adminEmails];
    if (emails.length === 0) return;

    const users = await this.usersRepository.find({ where: { email: In(emails) } });
    const promoted = users.filter((user) => !this.rolesOf(user).includes(Role.Admin));

    for (const user of promoted) {
      user.roles = [...this.rolesOf(user), Role.Admin];
    }

    if (promoted.length > 0) {
      await this.usersRepository.save(promoted);
      this.logger.log(
        `Granted admin from ADMIN_EMAILS to: ${promoted.map((u) => u.email).join(', ')}`,
      );
    }
  }

  /** Tolerates rows written before the roles column existed. */
  private rolesOf(user: User): Role[] {
    return user.roles?.length ? user.roles : [Role.User];
  }

  /**
   * Called once the Google profile has been verified *and* domain-checked. Creates the
   * user on first sign-in, and keeps their display name in sync with Google after that.
   */
  async signInWithGoogleProfile(profile: GoogleProfile): Promise<{ jwt: string; user: User }> {
    const email = profile.email.trim().toLowerCase();

    let user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      // Roles are seeded from config only at creation time; from then on the database is
      // authoritative, so later promotions/demotions aren't overwritten on every sign-in.
      user = this.usersRepository.create({
        email,
        roles: this.isAdminEmail(email) ? [Role.User, Role.Admin] : [Role.User],
      });
    }
    if (profile.name) {
      user.name = profile.name;
    }
    user.lastLoginAt = new Date();
    user = await this.usersRepository.save(user);

    const jwt = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: SESSION_TTL },
    );

    return { jwt, user };
  }

  async getUserById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  toSessionUser(user: User): SessionUser {
    const roles = this.rolesOf(user);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      isAdmin: roles.includes(Role.Admin),
    };
  }
}
