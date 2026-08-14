import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { SESSION_COOKIE_NAME } from './jwt-auth.guard';

const FRONTEND_URL = 'http://localhost:4200';
const STATE_COOKIE = 'grit_oauth_state';

interface FakeResponse extends Response {
  cookies: Record<string, { value: string; options: Record<string, unknown> }>;
  cleared: string[];
  redirectedTo: string | null;
}

function createResponse(): FakeResponse {
  const res = {
    cookies: {},
    cleared: [],
    redirectedTo: null,
  } as unknown as FakeResponse;

  res.cookie = jest.fn((name: string, value: string, options: Record<string, unknown>) => {
    res.cookies[name] = { value, options };
    return res;
  }) as unknown as Response['cookie'];

  res.clearCookie = jest.fn((name: string) => {
    res.cleared.push(name);
    return res;
  }) as unknown as Response['clearCookie'];

  res.redirect = jest.fn((url: string) => {
    res.redirectedTo = url;
  }) as unknown as Response['redirect'];

  return res;
}

function createRequest(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

describe('AuthController (Google sign-in)', () => {
  let controller: AuthController;
  let authService: { signInWithGoogleProfile: jest.Mock };
  let googleOAuthService: { buildAuthUrl: jest.Mock; fetchProfile: jest.Mock };

  beforeEach(() => {
    authService = {
      signInWithGoogleProfile: jest.fn().mockResolvedValue({ jwt: 'signed.jwt.value' }),
    };
    googleOAuthService = {
      buildAuthUrl: jest.fn((state: string) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`),
      fetchProfile: jest.fn(),
    };
    const configService = {
      get: (key: string, fallback?: string) => (key === 'FRONTEND_URL' ? FRONTEND_URL : fallback),
    };

    controller = new AuthController(
      authService as unknown as AuthService,
      googleOAuthService as unknown as GoogleOAuthService,
      configService as unknown as ConfigService,
    );
  });

  describe('GET /auth/google', () => {
    it('redirects to Google and stores the state in an httpOnly cookie', () => {
      const res = createResponse();

      controller.startGoogleSignIn(res);

      const stateCookie = res.cookies[STATE_COOKIE];
      expect(stateCookie).toBeDefined();
      expect(stateCookie.options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });
      expect(res.redirectedTo).toBe(
        `https://accounts.google.com/o/oauth2/v2/auth?state=${stateCookie.value}`,
      );
    });

    it('uses a different state on every attempt', () => {
      const first = createResponse();
      const second = createResponse();

      controller.startGoogleSignIn(first);
      controller.startGoogleSignIn(second);

      expect(first.cookies[STATE_COOKIE].value).not.toBe(second.cookies[STATE_COOKIE].value);
    });
  });

  describe('GET /auth/google/callback', () => {
    const state = 'a'.repeat(64);

    it('signs in a bitwarden.com account and sets the session cookie', async () => {
      googleOAuthService.fetchProfile.mockResolvedValue({
        email: 'jane.doe@bitwarden.com',
        name: 'Jane Doe',
      });
      const res = createResponse();

      await controller.googleCallback(
        'auth-code',
        state,
        undefined,
        createRequest({ [STATE_COOKIE]: state }),
        res,
      );

      expect(authService.signInWithGoogleProfile).toHaveBeenCalledWith({
        email: 'jane.doe@bitwarden.com',
        name: 'Jane Doe',
      });
      expect(res.cookies[SESSION_COOKIE_NAME].value).toBe('signed.jwt.value');
      expect(res.cookies[SESSION_COOKIE_NAME].options).toMatchObject({ httpOnly: true });
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/nominate`);
      expect(res.cleared).toContain(STATE_COOKIE);
    });

    it('rejects a non-bitwarden.com account without creating a session', async () => {
      googleOAuthService.fetchProfile.mockResolvedValue({
        email: 'someone@gmail.com',
        name: 'Someone Else',
      });
      const res = createResponse();

      await controller.googleCallback(
        'auth-code',
        state,
        undefined,
        createRequest({ [STATE_COOKIE]: state }),
        res,
      );

      expect(authService.signInWithGoogleProfile).not.toHaveBeenCalled();
      expect(res.cookies[SESSION_COOKIE_NAME]).toBeUndefined();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=domain`);
    });

    it('rejects a lookalike domain', async () => {
      googleOAuthService.fetchProfile.mockResolvedValue({
        email: 'attacker@notbitwarden.com',
        name: null,
      });
      const res = createResponse();

      await controller.googleCallback(
        'auth-code',
        state,
        undefined,
        createRequest({ [STATE_COOKIE]: state }),
        res,
      );

      expect(authService.signInWithGoogleProfile).not.toHaveBeenCalled();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=domain`);
    });

    it('rejects a callback whose state does not match the cookie', async () => {
      const res = createResponse();

      await controller.googleCallback(
        'auth-code',
        state,
        undefined,
        createRequest({ [STATE_COOKIE]: 'b'.repeat(64) }),
        res,
      );

      expect(googleOAuthService.fetchProfile).not.toHaveBeenCalled();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=state`);
    });

    it('rejects a callback with no state cookie at all', async () => {
      const res = createResponse();

      await controller.googleCallback('auth-code', state, undefined, createRequest(), res);

      expect(googleOAuthService.fetchProfile).not.toHaveBeenCalled();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=state`);
    });

    it('handles the user cancelling at Google', async () => {
      const res = createResponse();

      await controller.googleCallback(
        undefined,
        undefined,
        'access_denied',
        createRequest({ [STATE_COOKIE]: state }),
        res,
      );

      expect(googleOAuthService.fetchProfile).not.toHaveBeenCalled();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=cancelled`);
    });

    it('handles a failed token exchange', async () => {
      googleOAuthService.fetchProfile.mockRejectedValue(new Error('invalid_grant'));
      const res = createResponse();

      await controller.googleCallback(
        'auth-code',
        state,
        undefined,
        createRequest({ [STATE_COOKIE]: state }),
        res,
      );

      expect(authService.signInWithGoogleProfile).not.toHaveBeenCalled();
      expect(res.redirectedTo).toBe(`${FRONTEND_URL}/login?error=google`);
    });
  });
});
