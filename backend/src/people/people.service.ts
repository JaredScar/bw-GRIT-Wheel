import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GritCategory } from '../common/grit-category.enum';
import { NominationUpvote } from '../nominations/nomination-upvote.entity';
import { Nomination } from '../nominations/nomination.entity';
import { NominationsService, PublicNomination } from '../nominations/nominations.service';
import { RoundsService } from '../rounds/rounds.service';

export interface PersonSummary {
  name: string;
  nominationCount: number;
}

export interface PersonWin {
  roundId: string;
  roundTitle: string;
  spunAt: Date | null;
}

export interface PersonProfile {
  name: string;
  totalNominations: number;
  totalUpvotes: number;
  categoryBreakdown: { category: GritCategory; count: number }[];
  wins: PersonWin[];
  nominations: PublicNomination[];
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

const LEADERBOARD_LIMIT = 10;

@Injectable()
export class PeopleService {
  constructor(
    @InjectRepository(Nomination)
    private readonly nominationsRepository: Repository<Nomination>,
    @InjectRepository(NominationUpvote)
    private readonly upvotesRepository: Repository<NominationUpvote>,
    private readonly nominationsService: NominationsService,
    private readonly roundsService: RoundsService,
  ) {}

  async listPeople(): Promise<PersonSummary[]> {
    const rows = await this.nominationsRepository
      .createQueryBuilder('n')
      .select('MAX(n.nomineeName)', 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('LOWER(TRIM(n.nomineeName))')
      .orderBy('name', 'ASC')
      .getRawMany<{ name: string; count: string }>();

    return rows.map((row) => ({
      name: row.name,
      nominationCount: parseInt(row.count, 10),
    }));
  }

  async getProfile(name: string): Promise<PersonProfile> {
    const normalizedName = name.trim();
    const nominations = await this.nominationsService.findAll({ nomineeName: normalizedName });

    const displayName = nominations[0]?.nomineeName ?? normalizedName;
    const totalUpvotes = nominations.reduce((sum, n) => sum + n.upvoteCount, 0);

    const categoryCounts = new Map<GritCategory, number>();
    for (const nomination of nominations) {
      for (const category of nomination.gritCategories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }
    const categoryBreakdown = Array.from(categoryCounts.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    const winningRounds = await this.roundsService.findWinsByName(displayName);
    const wins = winningRounds.map((round) => ({
      roundId: round.id,
      roundTitle: round.title,
      spunAt: round.spunAt,
    }));

    return {
      name: displayName,
      totalNominations: nominations.length,
      totalUpvotes,
      categoryBreakdown,
      wins,
      nominations,
    };
  }

  async getLeaderboard(): Promise<Leaderboard> {
    const [topNominatedRows, topAgreedRows, topNominatorRows, categoryChampions] = await Promise.all([
      this.nominationsRepository
        .createQueryBuilder('n')
        .select('MAX(n.nomineeName)', 'name')
        .addSelect('COUNT(*)', 'count')
        .groupBy('LOWER(TRIM(n.nomineeName))')
        .orderBy('count', 'DESC')
        .limit(LEADERBOARD_LIMIT)
        .getRawMany<{ name: string; count: string }>(),
      this.nominationsRepository
        .createQueryBuilder('n')
        .leftJoin('n.upvotes', 'u')
        .select('MAX(n.nomineeName)', 'name')
        .addSelect('COUNT(u.id)', 'totalUpvotes')
        .groupBy('LOWER(TRIM(n.nomineeName))')
        .orderBy('"totalUpvotes"', 'DESC')
        .limit(LEADERBOARD_LIMIT)
        .getRawMany<{ name: string; totalUpvotes: string }>(),
      this.nominationsRepository
        .createQueryBuilder('n')
        .select('MAX(n.nominatorName)', 'name')
        .addSelect('COUNT(*)', 'count')
        .where('n.isAnonymous = false')
        .groupBy('LOWER(TRIM(n.nominatorEmail))')
        .orderBy('count', 'DESC')
        .limit(LEADERBOARD_LIMIT)
        .getRawMany<{ name: string; count: string }>(),
      this.getCategoryChampions(),
    ]);

    return {
      topNominated: topNominatedRows.map((row) => ({
        name: row.name,
        value: parseInt(row.count, 10),
      })),
      topAgreed: topAgreedRows
        .map((row) => ({
          name: row.name,
          value: parseInt(row.totalUpvotes, 10),
        }))
        .filter((entry) => entry.value > 0),
      topNominators: topNominatorRows.map((row) => ({
        name: row.name,
        value: parseInt(row.count, 10),
      })),
      categoryChampions,
    };
  }

  private async getCategoryChampions(): Promise<CategoryChampion[]> {
    const champions: CategoryChampion[] = [];

    for (const category of Object.values(GritCategory)) {
      const row = await this.nominationsRepository
        .createQueryBuilder('n')
        .select('MAX(n.nomineeName)', 'name')
        .addSelect('COUNT(*)', 'count')
        .where(':category = ANY(n.gritCategories)', { category })
        .groupBy('LOWER(TRIM(n.nomineeName))')
        .orderBy('count', 'DESC')
        .limit(1)
        .getRawOne<{ name: string; count: string }>();

      if (row) {
        champions.push({
          category,
          name: row.name,
          count: parseInt(row.count, 10),
        });
      }
    }

    return champions;
  }
}
