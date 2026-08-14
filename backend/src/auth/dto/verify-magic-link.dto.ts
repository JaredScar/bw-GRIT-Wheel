import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyMagicLinkDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}
