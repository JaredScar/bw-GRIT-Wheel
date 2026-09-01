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
  // Only needed when nomineeEmail isn't already in the directory, so the backend can
  // add the new person and connect them to this nomination.
  nomineeName?: string;
  gritCategories: GritCategory[];
  reason: string;
}
