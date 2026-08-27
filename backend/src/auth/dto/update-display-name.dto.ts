import { IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateDisplayNameDto {
  @IsNotEmpty({ message: 'A display name is required' })
  @MaxLength(120)
  name: string;
}
