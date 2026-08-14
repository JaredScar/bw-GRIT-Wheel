import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { GoogleProfile } from './google-oauth.service';
import { SessionUser } from './session-user';

const SESSION_TTL = '30d';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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
   * Called once the Google profile has been verified *and* domain-checked. Creates the
   * user on first sign-in, and keeps their display name in sync with Google after that.
   */
  async signInWithGoogleProfile(profile: GoogleProfile): Promise<{ jwt: string; user: User }> {
    const email = profile.email.trim().toLowerCase();

    let user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      user = this.usersRepository.create({ email });
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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdmin: this.isAdminEmail(user.email),
    };
  }
}
