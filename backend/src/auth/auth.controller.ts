import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { SESSION_COOKIE_NAME } from './jwt-auth.guard';
import { Public } from './public.decorator';
import type { SessionUser } from './session-user';

const SESSION_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('magic-link')
  @HttpCode(200)
  async requestMagicLink(@Body() dto: RequestMagicLinkDto) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    await this.authService.requestMagicLink(dto.email, frontendUrl);
    return { message: 'Check your email for a sign-in link.' };
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: VerifyMagicLinkDto, @Res({ passthrough: true }) res: Response) {
    const { jwt, user } = await this.authService.verifyToken(dto.token);
    res.cookie(SESSION_COOKIE_NAME, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<string>('COOKIE_SECURE') === 'true',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    return user;
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
