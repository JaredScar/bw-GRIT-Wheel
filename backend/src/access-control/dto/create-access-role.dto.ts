import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Permission } from '../permission.enum';

export class CreateAccessRoleDto {
  @IsNotEmpty({ message: 'Role name is required' })
  @IsString()
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(Permission, { each: true, message: 'Unknown permission' })
  permissions: Permission[] = [];
}
