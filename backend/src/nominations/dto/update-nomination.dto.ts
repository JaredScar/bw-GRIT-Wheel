import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GritCategory } from '../../common/grit-category.enum';

/**
 * Admin correction of an existing nomination. Every field is optional — the UI sends the
 * whole form, but a caller may patch just one.
 *
 * The nominator's identity is deliberately absent: it comes from their verified Google
 * session at submission time, and letting an admin reattribute a nomination to someone
 * who didn't write it would undermine that. Only `isAnonymous` (whether that identity is
 * shown) can be changed.
 */
export class UpdateNominationDto {
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsEmail({}, { message: 'Please select the nominee from the list' })
  nomineeEmail?: string;

  // Only used when nomineeEmail isn't already in the directory — mirrors the create flow,
  // where a nominator can add a missing person on the spot.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nomineeName?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Please select at least one GRIT value' })
  @IsEnum(GritCategory, { each: true, message: 'A valid GRIT category must be selected' })
  gritCategories?: GritCategory[];

  @IsOptional()
  @MinLength(10, { message: 'Please share a bit more detail (at least 10 characters)' })
  @MaxLength(2000)
  reason?: string;
}
