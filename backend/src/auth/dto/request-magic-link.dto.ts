import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class RequestMagicLinkDto {
  @IsBitwardenEmail()
  email: string;
}
