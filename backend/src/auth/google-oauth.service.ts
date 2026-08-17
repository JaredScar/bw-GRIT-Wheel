import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export const HOSTED_DOMAIN = 'bitwarden.com';

const SCOPES = ['openid', 'email', 'profile'];

export interface GoogleProfile {
  email: string;
  name: string | null;
  picture: string | null;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private readonly clientId: string;
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET', '');

    if (!this.clientId || !clientSecret) {
      this.logger.error(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — nobody will be able to sign in.',
      );
    }

    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret,
      redirectUri: this.redirectUri,
    });
  }

  private get redirectUri(): string {
    const explicit = this.configService.get<string>('GOOGLE_REDIRECT_URI', '');
    if (explicit) return explicit;

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    return `${frontendUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  }

  /**
   * `hd` only pre-filters Google's account chooser — it is a hint, not a guarantee,
   * so the returned profile still has to be domain-checked by the caller.
   */
  buildAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      scope: SCOPES,
      state,
      hd: HOSTED_DOMAIN,
      prompt: 'select_account',
    });
  }

  async fetchProfile(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google did not return an identity token');
    }

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account has no verified email address');
    }

    return {
      email: payload.email.trim().toLowerCase(),
      name: payload.name?.trim() || null,
      picture: payload.picture?.trim() || null,
    };
  }
}
