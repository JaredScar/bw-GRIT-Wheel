import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class UploadPhotoDto {
  @IsBitwardenEmail()
  email: string;
}
