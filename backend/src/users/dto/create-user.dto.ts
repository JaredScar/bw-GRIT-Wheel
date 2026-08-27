import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class CreateUserDto {
  @IsBitwardenEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;
}
