import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GritCategory } from '../../common/grit-category.enum';

export class CreateNominationDto {
  @IsNotEmpty({ message: 'Your name is required' })
  @MaxLength(120)
  nominatorName: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsEmail({}, { message: 'Please select the nominee from the list' })
  nomineeEmail: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one GRIT value' })
  @IsEnum(GritCategory, { each: true, message: 'A valid GRIT category must be selected' })
  gritCategories: GritCategory[];

  @IsNotEmpty({ message: 'Please share why you are nominating this person' })
  @MinLength(10, { message: 'Please share a bit more detail (at least 10 characters)' })
  @MaxLength(2000)
  reason: string;
}
