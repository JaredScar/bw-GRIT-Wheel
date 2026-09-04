import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class DevLoginDto {
  @IsBitwardenEmail()
  email: string;
}
