import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Team name is required' })
  @MaxLength(160)
  name?: string;

  // '' explicitly clears the manager; omitting the field leaves it unchanged.
  @IsOptional()
  @ValidateIf((dto: UpdateTeamDto) => dto.managerEmail !== '')
  @IsBitwardenEmail()
  managerEmail?: string;
}
