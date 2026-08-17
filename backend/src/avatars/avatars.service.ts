import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

export interface Avatar {
  data: Buffer;
  contentType: string;
}

/** Only Google's image CDN is ever fetched, however the column got populated. */
const ALLOWED_HOST_SUFFIX = '.googleusercontent.com';

const FETCH_TIMEOUT_MS = 5_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Google hands out `=s96-c` by default, which is too small for the 1200x630 winner
 * card. Anything larger is served from the same CDN at no extra cost to us.
 */
const REQUESTED_SIZE = 's256-c';

const HIT_TTL_MS = 60 * 60 * 1000;
/** Shorter, so somebody who just signed in shows up without an hour's delay. */
const MISS_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  avatar: Avatar | null;
  expiresAt: number;
}

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  /**
   * In-process only, so it empties on restart and is not shared between instances.
   * That is fine for a single-container deployment, and it keeps a feed page full of
   * avatars from fanning out to one outbound request per card on every load.
   */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getAvatar(email: string): Promise<Avatar | null> {
    const normalizedEmail = email.trim().toLowerCase();

    const cached = this.cache.get(normalizedEmail);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.avatar;
    }

    const avatar = await this.load(normalizedEmail);
    this.remember(normalizedEmail, avatar);
    return avatar;
  }

  private async load(email: string): Promise<Avatar | null> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user?.pictureUrl) {
      // Expected for anyone who has been nominated but never signed in.
      return null;
    }

    const url = this.toFetchableUrl(user.pictureUrl);
    if (!url) {
      this.logger.warn(`Refusing to fetch non-Google avatar URL for ${email}`);
      return null;
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        this.logger.warn(`Google returned ${response.status} for ${email}'s avatar`);
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        this.logger.warn(`Google returned a non-image (${contentType}) for ${email}'s avatar`);
        return null;
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (data.byteLength > MAX_IMAGE_BYTES) {
        this.logger.warn(`Avatar for ${email} exceeded ${MAX_IMAGE_BYTES} bytes`);
        return null;
      }

      return { data, contentType };
    } catch (error) {
      // Never let a slow or broken CDN take a page down; the client falls back to initials.
      this.logger.warn(`Failed to fetch avatar for ${email}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Guards the one outbound request this service makes. The URL comes from Google's
   * verified ID token today, but it is read back out of the database, so it is
   * host-checked here rather than trusted on the way in.
   */
  private toFetchableUrl(pictureUrl: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(pictureUrl);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.endsWith(ALLOWED_HOST_SUFFIX)) return null;

    return parsed.toString().replace(/=s\d+(-c)?$/, `=${REQUESTED_SIZE}`);
  }

  private remember(email: string, avatar: Avatar | null): void {
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      // Map preserves insertion order, so the first key is the oldest.
      for (const oldest of this.cache.keys()) {
        this.cache.delete(oldest);
        break;
      }
    }

    this.cache.set(email, {
      avatar,
      expiresAt: Date.now() + (avatar ? HIT_TTL_MS : MISS_TTL_MS),
    });
  }
}
