import { GritCategory } from './grit-category';
import { Nomination } from './nomination.model';

export interface PersonSummary {
  name: string;
  nominationCount: number;
}

export interface PersonWin {
  roundId: string;
  roundTitle: string;
  spunAt: string | null;
}

export interface PersonProfile {
  name: string;
  totalNominations: number;
  totalUpvotes: number;
  categoryBreakdown: { category: GritCategory; count: number }[];
  wins: PersonWin[];
  nominations: Nomination[];
}

export interface LeaderboardEntry {
  name: string;
  value: number;
}

export interface CategoryChampion {
  category: GritCategory;
  name: string;
  count: number;
}

export interface Leaderboard {
  topNominated: LeaderboardEntry[];
  topAgreed: LeaderboardEntry[];
  topNominators: LeaderboardEntry[];
  categoryChampions: CategoryChampion[];
}
