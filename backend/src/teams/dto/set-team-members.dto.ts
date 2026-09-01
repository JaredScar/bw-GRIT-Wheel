import { ArrayUnique, IsArray } from 'class-validator';
import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class SetTeamMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsBitwardenEmail({ each: true })
  emails: string[];
}
