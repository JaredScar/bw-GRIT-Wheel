import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GritCategory } from '../../common/grit-category.enum';

export class CreateNominationDto {
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsEmail({}, { message: 'Please select the nominee from the list' })
  nomineeEmail: string;

  // Only used when nomineeEmail isn't already in the directory — lets the nominator
  // add a new person on the spot instead of being blocked until the next roster import.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomineeName?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one GRIT value' })
  @IsEnum(GritCategory, { each: true, message: 'A valid GRIT category must be selected' })
  gritCategories: GritCategory[];

  @IsNotEmpty({ message: 'Please share why you are nominating this person' })
  @MinLength(10, { message: 'Please share a bit more detail (at least 10 characters)' })
  @MaxLength(2000)
  reason: string;
}
