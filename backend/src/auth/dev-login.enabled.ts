import { ConfigService } from '@nestjs/config';

/**
 * Local-development sign-in bypass. Real Google OAuth needs a registered client and a
 * public callback URL, which nobody has when running on localhost, so this lets a
 * developer mint a session for any @bitwarden.com address.
 *
 * It is a genuine authentication bypass: anyone who can reach the endpoint becomes any
 * user they name. It is therefore off unless explicitly switched on, and
 * `assertDevLoginIsSafe()` refuses to let the app boot if it's on in a deployment that
 * looks remotely production-like.
 */
export function isDevLoginEnabled(configService: ConfigService): boolean {
  return configService.get<string>('DEV_LOGIN_ENABLED') === 'true';
}

/**
 * Fail-fast so a stray `DEV_LOGIN_ENABLED=true` can never reach production silently.
 * `COOKIE_SECURE=true` means cookies are being served over HTTPS, which only happens in
 * a real deployment — the local docker-compose and dev setups both leave it false.
 */
export function assertDevLoginIsSafe(configService: ConfigService): void {
  if (!isDevLoginEnabled(configService)) return;

  const productionSignals = [
    configService.get<string>('NODE_ENV') === 'production'
      ? 'NODE_ENV=production'
      : null,
    configService.get<string>('COOKIE_SECURE') === 'true'
      ? 'COOKIE_SECURE=true'
      : null,
  ].filter(Boolean);

  if (productionSignals.length > 0) {
    throw new Error(
      `DEV_LOGIN_ENABLED=true is set alongside ${productionSignals.join(' and ')}. ` +
        'The dev sign-in bypass lets anyone log in as any user and must never be enabled ' +
        'outside local development. Remove DEV_LOGIN_ENABLED from this environment.',
    );
  }
}
