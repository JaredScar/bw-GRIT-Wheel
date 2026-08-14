import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { MagicLinkToken } from './magic-link-token.entity';
import { MailerService } from './mailer.service';
import { SessionUser } from './session-user';

const TOKEN_TTL_MINUTES = 15;
const RESEND_COOLDOWN_SECONDS = 45;
const SESSION_TTL = '30d';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(MagicLinkToken)
    private readonly tokensRepository: Repository<MagicLinkToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
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

  async requestMagicLink(rawEmail: string, frontendUrl: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();

    const recentToken = await this.tokensRepository.findOne({
      where: {
        email,
        createdAt: MoreThan(new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000)),
      },
      order: { createdAt: 'DESC' },
    });
    if (recentToken) {
      // A link was just sent; avoid spamming the inbox (and Slack-style abuse) on repeated clicks.
      return;
    }

    const existing = await this.usersRepository.findOne({ where: { email } });
    if (!existing) {
      await this.usersRepository.save(this.usersRepository.create({ email }));
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await this.tokensRepository.save(this.tokensRepository.create({ email, tokenHash, expiresAt }));

    const link = `${frontendUrl.replace(/\/$/, '')}/auth/verify?token=${rawToken}`;
    await this.mailerService.sendMagicLink(email, link);
  }

  async verifyToken(rawToken: string): Promise<{ jwt: string; user: SessionUser }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.tokensRepository.findOne({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('This sign-in link is invalid or has expired');
    }

    record.usedAt = new Date();
    await this.tokensRepository.save(record);

    let user = await this.usersRepository.findOne({ where: { email: record.email } });
    if (!user) {
      user = await this.usersRepository.save(this.usersRepository.create({ email: record.email }));
    }
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);

    const jwt = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: SESSION_TTL },
    );

    return { jwt, user: this.toSessionUser(user) };
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
