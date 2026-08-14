import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GritCategory } from '../../common/grit-category.enum';
import { IsBitwardenEmail } from '../../common/bitwarden-email.validator';

export class CreateNominationDto {
  @IsNotEmpty({ message: 'Your name is required' })
  @MaxLength(120)
  nominatorName: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsNotEmpty({ message: "The nominee's name is required" })
  @MaxLength(120)
  nomineeName: string;

  @IsBitwardenEmail()
  nomineeEmail: string;

  @IsEnum(GritCategory, { message: 'A valid GRIT category must be selected' })
  gritCategory: GritCategory;

  @IsNotEmpty({ message: 'Please share why you are nominating this person' })
  @MinLength(10, { message: 'Please share a bit more detail (at least 10 characters)' })
  @MaxLength(2000)
  reason: string;
}
