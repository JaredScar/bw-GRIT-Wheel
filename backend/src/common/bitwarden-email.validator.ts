import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const BITWARDEN_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@bitwarden\.com$/i;

/**
 * The single source of truth for "is this one of us?". Used both by the DTO
 * validator below and by the Google OAuth callback, which has to reject
 * non-Bitwarden Google accounts before it will mint a session.
 */
export function isBitwardenEmail(email: unknown): email is string {
  return typeof email === 'string' && BITWARDEN_EMAIL_REGEX.test(email.trim());
}

@ValidatorConstraint({ name: 'isBitwardenEmail', async: false })
export class IsBitwardenEmailConstraint implements ValidatorConstraintInterface {
  validate(email: unknown): boolean {
    return isBitwardenEmail(email);
  }

  defaultMessage(): string {
    return 'Email must be a valid @bitwarden.com address';
  }
}

export function IsBitwardenEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBitwardenEmailConstraint,
    });
  };
}
