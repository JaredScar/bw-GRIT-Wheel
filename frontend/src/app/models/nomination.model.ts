import { GritCategory } from './grit-category';

export interface Nomination {
  id: string;
  nominatorName: string | null;
  isAnonymous: boolean;
  nomineeName: string;
  gritCategories: GritCategory[];
  reason: string;
  roundId: string;
  createdAt: string;
  upvoteCount: number;
  hasUpvoted: boolean;
  canUpvote: boolean;
}

export interface ToggleUpvoteResult {
  upvoteCount: number;
  hasUpvoted: boolean;
}

export interface CreateNominationPayload {
  nominatorName: string;
  isAnonymous: boolean;
  nomineeName: string;
  gritCategories: GritCategory[];
  reason: string;
}
