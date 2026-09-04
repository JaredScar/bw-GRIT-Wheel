import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GritCategory } from '../common/grit-category.enum';
import { NominationUpvote } from '../nominations/nomination-upvote.entity';
import { Nomination } from '../nominations/nomination.entity';
import { ReactionType } from '../nominations/reaction-type.enum';
import { Round } from '../rounds/round.entity';

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

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Nomination)
    private readonly nominationsRepository: Repository<Nomination>,
    @InjectRepository(NominationUpvote)
    private readonly upvotesRepository: Repository<NominationUpvote>,
    @InjectRepository(Round)
    private readonly roundsRepository: Repository<Round>,
  ) {}

  async getSummary(): Promise<AnalyticsSummary> {
    const [totalNominations, totalRounds, totalUpvotes, rounds] = await Promise.all([
      this.nominationsRepository.count(),
      this.roundsRepository.count(),
      // Joined through nominations rather than counted straight off the reactions table:
      // reactions on a soft-deleted nomination stay in the database so a restore brings
      // them back, but they shouldn't show up in the totals while it's deleted.
      this.upvotesRepository
        .createQueryBuilder('u')
        .innerJoin(Nomination, 'n', 'n.id = u.nominationId AND n."deletedAt" IS NULL')
        .where('u.type = :reactionType', { reactionType: ReactionType.THUMBS_UP })
        .getCount(),
      this.roundsRepository.find(),
    ]);

    const [categoryRows, uniqueNomineesRow, uniqueNominatorsRow, byRoundRows] = await Promise.all([
      this.nominationsRepository.manager
        .createQueryBuilder()
        .select('category')
        .addSelect('COUNT(*)', 'count')
        // Soft-deleted rows are filtered by hand here: TypeORM only adds its automatic
        // `deletedAt IS NULL` to the query builder's own root entity, not to a subquery
        // this one selects FROM.
        .from(
          (qb) =>
            qb
              .select('UNNEST(n."gritCategories")', 'category')
              .from(Nomination, 'n')
              .where('n."deletedAt" IS NULL'),
          'categories',
        )
        .groupBy('category')
        .getRawMany<{ category: string; count: string }>(),
      this.nominationsRepository
        .createQueryBuilder('n')
        .select('COUNT(DISTINCT n.nomineeEmail)', 'count')
        .getRawOne<{ count: string }>(),
      this.nominationsRepository
        .createQueryBuilder('n')
        .select('COUNT(DISTINCT n.nominatorEmail)', 'count')
        .getRawOne<{ count: string }>(),
      this.nominationsRepository
        .createQueryBuilder('n')
        .select('n.roundId', 'roundId')
        .addSelect('COUNT(*)', 'count')
        .groupBy('n.roundId')
        .getRawMany<{ roundId: string; count: string }>(),
    ]);

    const roundMap = new Map(rounds.map((round) => [round.id, round]));
    const nominationsByRound: RoundCount[] = byRoundRows
      .map((row) => ({
        roundId: row.roundId,
        roundTitle: roundMap.get(row.roundId)?.title ?? 'Unknown round',
        count: parseInt(row.count, 10),
        createdAt: roundMap.get(row.roundId)?.createdAt ?? new Date(0),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ roundId, roundTitle, count }) => ({ roundId, roundTitle, count }));

    return {
      totalNominations,
      totalRounds,
      totalUpvotes,
      uniqueNominees: parseInt(uniqueNomineesRow?.count ?? '0', 10),
      uniqueNominators: parseInt(uniqueNominatorsRow?.count ?? '0', 10),
      averageNominationsPerRound:
        totalRounds > 0 ? Math.round((totalNominations / totalRounds) * 10) / 10 : 0,
      nominationsByCategory: categoryRows.map((row) => ({
        category: row.category as GritCategory,
        count: parseInt(row.count, 10),
      })),
      nominationsByRound,
    };
  }
}
