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
  /** Set when an admin has corrected this nomination; the feed shows an "edited" marker. */
  editedAt: string | null;
  /** Only ever set on results from the admin-only "show deleted" view. */
  deletedAt: string | null;
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

/**
 * Admin correction of an existing nomination. The nominator is intentionally not editable —
 * it comes from their verified sign-in — so only whether their name is shown can change.
 */
export interface UpdateNominationPayload {
  isAnonymous: boolean;
  nomineeEmail: string;
  // As with creating, only needed when the nominee isn't in the directory yet.
  nomineeName?: string;
  gritCategories: GritCategory[];
  reason: string;
}
