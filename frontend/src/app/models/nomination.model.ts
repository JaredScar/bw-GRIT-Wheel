import { GritCategory } from './grit-category';
import { ReactionType } from './reaction-type';

export interface Nomination {
  id: string;
  nominatorName: string | null;
  isAnonymous: boolean;
  nomineeName: string;
  nomineeEmail: string;
  gritCategories: GritCategory[];
  reason: string;
  roundId: string;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

export interface ToggleReactionResult {
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

export interface CreateNominationPayload {
  isAnonymous: boolean;
  nomineeEmail: string;
  gritCategories: GritCategory[];
  reason: string;
}
