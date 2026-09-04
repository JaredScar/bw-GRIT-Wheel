import { ConfigService } from '@nestjs/config';
import { assertDevLoginIsSafe, isDevLoginEnabled } from './dev-login.enabled';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('isDevLoginEnabled', () => {
  it('is off when the variable is absent', () => {
    expect(isDevLoginEnabled(config({}))).toBe(false);
  });

  it('requires the exact string "true", not merely a truthy value', () => {
    expect(isDevLoginEnabled(config({ DEV_LOGIN_ENABLED: '1' }))).toBe(false);
    expect(isDevLoginEnabled(config({ DEV_LOGIN_ENABLED: 'yes' }))).toBe(false);
    expect(isDevLoginEnabled(config({ DEV_LOGIN_ENABLED: 'TRUE' }))).toBe(
      false,
    );
    expect(isDevLoginEnabled(config({ DEV_LOGIN_ENABLED: 'true' }))).toBe(true);
  });
});

describe('assertDevLoginIsSafe', () => {
  it('allows a local setup: dev login on, nothing production-like', () => {
    expect(() =>
      assertDevLoginIsSafe(
        config({ DEV_LOGIN_ENABLED: 'true', COOKIE_SECURE: 'false' }),
      ),
    ).not.toThrow();
  });

  it('is a no-op when dev login is off, whatever else is set', () => {
    expect(() =>
      assertDevLoginIsSafe(
        config({ NODE_ENV: 'production', COOKIE_SECURE: 'true' }),
      ),
    ).not.toThrow();
  });

  it('refuses NODE_ENV=production', () => {
    expect(() =>
      assertDevLoginIsSafe(
        config({ DEV_LOGIN_ENABLED: 'true', NODE_ENV: 'production' }),
      ),
    ).toThrow(/NODE_ENV=production/);
  });

  it('refuses COOKIE_SECURE=true, which only happens behind real HTTPS', () => {
    expect(() =>
      assertDevLoginIsSafe(
        config({ DEV_LOGIN_ENABLED: 'true', COOKIE_SECURE: 'true' }),
      ),
    ).toThrow(/COOKIE_SECURE=true/);
  });

  it('names every production signal it found', () => {
    expect(() =>
      assertDevLoginIsSafe(
        config({
          DEV_LOGIN_ENABLED: 'true',
          NODE_ENV: 'production',
          COOKIE_SECURE: 'true',
        }),
      ),
    ).toThrow(/NODE_ENV=production and COOKIE_SECURE=true/);
  });
});
