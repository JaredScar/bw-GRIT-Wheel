import { IsDateString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateRoundDto {
  @IsNotEmpty({ message: 'A round title is required' })
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;
}
