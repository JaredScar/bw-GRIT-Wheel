import { IsNotEmpty, IsString } from 'class-validator';

export class ImportDirectoryDto {
  @IsString()
  @IsNotEmpty({ message: 'CSV content is required' })
  csv: string;
}
