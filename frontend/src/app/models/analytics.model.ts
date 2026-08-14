import { GritCategory } from './grit-category';

export interface CategoryCount {
  category: GritCategory;
  count: number;
}

export interface RoundCount {
  roundId: string;
  roundTitle: string;
  count: number;
}

export interface AnalyticsSummary {
  totalNominations: number;
  totalRounds: number;
  totalUpvotes: number;
  uniqueNominees: number;
  uniqueNominators: number;
  averageNominationsPerRound: number;
  nominationsByCategory: CategoryCount[];
  nominationsByRound: RoundCount[];
}
