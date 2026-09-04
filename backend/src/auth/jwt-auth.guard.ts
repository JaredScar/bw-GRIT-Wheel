import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SessionUser } from './session-user';

export const SESSION_COOKIE_NAME = 'grit_session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('You must be signed in');
    }

    let payload: { sub: string; email: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(token);
    } catch {
      throw new UnauthorizedException('Your session has expired, please sign in again');
    }

    const user = await this.authService.getUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid');
    }

    request.user = await this.authService.toSessionUser(user);
    return true;
  }
}
