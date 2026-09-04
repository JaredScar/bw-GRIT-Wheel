import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Both fields are optional so the admin users screen can rename an account and change its
 * access role independently.
 */
export class UpdateUserDto {
  @IsOptional()
  @IsNotEmpty({ message: 'Name cannot be blank' })
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Unknown access role' })
  accessRoleId?: string;
}
