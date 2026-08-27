import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { isBitwardenEmail } from '../common/bitwarden-email.validator';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { UpdateDisplayNameDto } from './dto/update-display-name.dto';
import { GoogleOAuthService } from './google-oauth.service';
import { SESSION_COOKIE_NAME } from './jwt-auth.guard';
import { Public } from './public.decorator';
import type { SessionUser } from './session-user';

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_COOKIE_NAME = 'grit_oauth_state';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('google')
  startGoogleSignIn(@Res({ passthrough: true }) res: Response): void {
    const state = randomBytes(32).toString('hex');

    res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
      ...this.baseCookieOptions,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
    });

    res.redirect(this.googleOAuthService.buildAuthUrl(state));
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const expectedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME] as string | undefined;
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, { path: '/' });

    if (error || !code) {
      // Most commonly the person hit "Cancel" on Google's consent screen.
      return this.redirectToLogin(res, 'cancelled');
    }

    if (!state || !expectedState || !this.statesMatch(state, expectedState)) {
      return this.redirectToLogin(res, 'state');
    }

    let profile: Awaited<ReturnType<GoogleOAuthService['fetchProfile']>>;
    try {
      profile = await this.googleOAuthService.fetchProfile(code);
    } catch {
      return this.redirectToLogin(res, 'google');
    }

    if (!isBitwardenEmail(profile.email)) {
      return this.redirectToLogin(res, 'domain');
    }

    const { jwt } = await this.authService.signInWithGoogleProfile(profile);

    res.cookie(SESSION_COOKIE_NAME, jwt, {
      ...this.baseCookieOptions,
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });

    res.redirect(`${this.frontendUrl}/nominate`);
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Patch('me')
  async updateMe(@Body() dto: UpdateDisplayNameDto, @CurrentUser() user: SessionUser) {
    const updated = await this.authService.updateDisplayName(user.id, dto.name);
    return this.authService.toSessionUser(updated);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  private get frontendUrl(): string {
    return this.configService
      .get<string>('FRONTEND_URL', 'http://localhost:4200')
      .replace(/\/$/, '');
  }

  private get baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('COOKIE_SECURE') === 'true',
      path: '/',
    };
  }

  private statesMatch(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private redirectToLogin(res: Response, reason: string): void {
    res.redirect(`${this.frontendUrl}/login?error=${reason}`);
  }
}
