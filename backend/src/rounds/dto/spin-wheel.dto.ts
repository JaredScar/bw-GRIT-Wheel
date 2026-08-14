import { IsBoolean, IsOptional } from 'class-validator';

export class SpinWheelDto {
  @IsOptional()
  @IsBoolean()
  weighted?: boolean;
}
