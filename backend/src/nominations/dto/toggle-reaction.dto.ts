import { IsEnum } from 'class-validator';
import { ReactionType } from '../reaction-type.enum';

export class ToggleReactionDto {
  @IsEnum(ReactionType, { message: 'A valid reaction type must be provided' })
  type: ReactionType;
}
