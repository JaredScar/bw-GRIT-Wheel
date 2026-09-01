import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1, { message: 'Team name is required' })
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsBitwardenEmail()
  managerEmail?: string;
}
