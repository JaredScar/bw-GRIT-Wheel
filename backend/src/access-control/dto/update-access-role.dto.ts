import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Permission } from '../permission.enum';

/** Every field is optional — the admin UI patches permissions and metadata separately. */
export class UpdateAccessRoleDto {
  @IsOptional()
  @IsNotEmpty({ message: 'Role name cannot be blank' })
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true, message: 'Unknown permission' })
  permissions?: Permission[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
