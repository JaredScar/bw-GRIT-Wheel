import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const BITWARDEN_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@bitwarden\.com$/i;

@ValidatorConstraint({ name: 'isBitwardenEmail', async: false })
export class IsBitwardenEmailConstraint implements ValidatorConstraintInterface {
  validate(email: unknown): boolean {
    return typeof email === 'string' && BITWARDEN_EMAIL_REGEX.test(email.trim());
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
