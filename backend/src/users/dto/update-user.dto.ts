import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MaxLength(160)
  name: string;
}
