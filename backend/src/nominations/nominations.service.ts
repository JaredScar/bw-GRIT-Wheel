import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { SessionUser } from '../auth/session-user';
import { GritCategory } from '../common/grit-category.enum';
import { DirectoryService } from '../directory/directory.service';
import { SlackNotificationService } from '../notifications/slack-notification.service';
import { RoundsService } from '../rounds/rounds.service';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { NominationUpvote } from './nomination-upvote.entity';
import { Nomination } from './nomination.entity';
import { ReactionType, REACTION_TYPES } from './reaction-type.enum';

export interface PublicNomination {
  id: string;
  nominatorName: string | null;
  isAnonymous: boolean;
  nomineeName: string;
  nomineeEmail: string;
  gritCategories: GritCategory[];
  reason: string;
  roundId: string;
  createdAt: Date;
  // Kept for existing consumers (person page, leaderboard, analytics) that only ever
  // cared about the original thumbs-up reaction.
  upvoteCount: number;
  hasUpvoted: boolean;
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

export interface ToggleReactionResult {
  reactionCounts: Record<ReactionType, number>;
  myReactions: ReactionType[];
}

function emptyReactionCounts(): Record<ReactionType, number> {
  return REACTION_TYPES.reduce(
    (acc, type) => ({ ...acc, [type]: 0 }),
    {} as Record<ReactionType, number>,
  );
}

@Injectable()
export class NominationsService {
  constructor(
    @InjectRepository(Nomination)
    private readonly nominationsRepository: Repository<Nomination>,
    @InjectRepository(NominationUpvote)
    private readonly upvotesRepository: Repository<NominationUpvote>,
    private readonly roundsService: RoundsService,
    private readonly slackNotificationService: SlackNotificationService,
    private readonly directoryService: DirectoryService,
  ) {}

  async create(dto: CreateNominationDto, nominator: SessionUser): Promise<PublicNomination> {
    const nominee = await this.directoryService.findByEmail(dto.nomineeEmail);
    if (!nominee) {
      throw new BadRequestException('Please select the nominee from the list');
    }

    const currentRound = await this.roundsService.getOrCreateCurrentOpenRound();

    const nomination = this.nominationsRepository.create({
      // Taken from the nominator's own signed-in account rather than a free-text
      // field, so it can't drift from a typo and always matches who they really are.
      nominatorName: nominator.name?.trim() || nominator.email,
      nominatorEmail: nominator.email.trim().toLowerCase(),
      isAnonymous: dto.isAnonymous ?? false,
      nomineeName: nominee.name,
      nomineeEmail: nominee.email,
      gritCategories: dto.gritCategories,
      reason: dto.reason.trim(),
      roundId: currentRound.id,
    });

    const saved = await this.nominationsRepository.save(nomination);

    void this.slackNotificationService.notifyNewNomination({
      nomineeName: saved.nomineeName,
      gritCategories: saved.gritCategories,
      reason: saved.reason,
      isAnonymous: saved.isAnonymous,
      nominatorName: saved.nominatorName,
    });

    return this.toPublic(saved, emptyReactionCounts(), []);
  }

  async findAll(filters: {
    roundId?: string;
    gritCategory?: GritCategory;
    nomineeEmail?: string;
    viewerEmail?: string;
  }): Promise<PublicNomination[]> {
    const qb = this.nominationsRepository.createQueryBuilder('n');

    if (filters.roundId) {
      qb.andWhere('n.roundId = :roundId', { roundId: filters.roundId });
    }
    if (filters.gritCategory) {
      qb.andWhere(':category = ANY(n.gritCategories)', { category: filters.gritCategory });
    }
    if (filters.nomineeEmail) {
      qb.andWhere('n.nomineeEmail = :nomineeEmail', {
        nomineeEmail: filters.nomineeEmail.trim().toLowerCase(),
      });
    }
    qb.orderBy('n.createdAt', 'DESC');

    const nominations = await qb.getMany();

    if (nominations.length === 0) {
      return [];
    }

    const ids = nominations.map((n) => n.id);
    const countMap = await this.getReactionCounts(ids);
    const myReactionsMap = filters.viewerEmail
      ? await this.getMyReactions(ids, filters.viewerEmail)
      : new Map<string, ReactionType[]>();

    return nominations.map((n) =>
      this.toPublic(n, countMap.get(n.id) ?? emptyReactionCounts(), myReactionsMap.get(n.id) ?? []),
    );
  }

  async findOnePublic(id: string, viewerEmail?: string): Promise<PublicNomination> {
    const nomination = await this.nominationsRepository.findOne({ where: { id } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    const countMap = await this.getReactionCounts([id]);
    const myReactionsMap = viewerEmail
      ? await this.getMyReactions([id], viewerEmail)
      : new Map<string, ReactionType[]>();

    return this.toPublic(
      nomination,
      countMap.get(id) ?? emptyReactionCounts(),
      myReactionsMap.get(id) ?? [],
    );
  }

  async findEntitiesByRound(roundId: string): Promise<Nomination[]> {
    return this.nominationsRepository.find({ where: { roundId } });
  }

  // Reactions are open on any nomination regardless of round status — people should be
  // able to like/support a nomination whether or not the round it came from has been
  // spun on the wheel yet.
  async toggleReaction(
    nominationId: string,
    voterEmail: string,
    type: ReactionType,
  ): Promise<ToggleReactionResult> {
    const nomination = await this.nominationsRepository.findOne({ where: { id: nominationId } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    const normalizedEmail = voterEmail.trim().toLowerCase();
    const existing = await this.upvotesRepository.findOne({
      where: { nominationId, voterEmail: normalizedEmail, type },
    });

    if (existing) {
      await this.upvotesRepository.delete(existing.id);
    } else {
      await this.upvotesRepository.save(
        this.upvotesRepository.create({ nominationId, voterEmail: normalizedEmail, type }),
      );
    }

    const countMap = await this.getReactionCounts([nominationId]);
    const myReactionsMap = await this.getMyReactions([nominationId], normalizedEmail);

    return {
      reactionCounts: countMap.get(nominationId) ?? emptyReactionCounts(),
      myReactions: myReactionsMap.get(nominationId) ?? [],
    };
  }

  private async getReactionCounts(
    nominationIds: string[],
  ): Promise<Map<string, Record<ReactionType, number>>> {
    if (nominationIds.length === 0) return new Map();

    const rows = await this.upvotesRepository
      .createQueryBuilder('reaction')
      .select('reaction.nominationId', 'nominationId')
      .addSelect('reaction.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('reaction.nominationId IN (:...nominationIds)', { nominationIds })
      .groupBy('reaction.nominationId')
      .addGroupBy('reaction.type')
      .getRawMany<{ nominationId: string; type: ReactionType; count: string }>();

    const map = new Map<string, Record<ReactionType, number>>();
    for (const row of rows) {
      const counts = map.get(row.nominationId) ?? emptyReactionCounts();
      counts[row.type] = parseInt(row.count, 10);
      map.set(row.nominationId, counts);
    }
    return map;
  }

  private async getMyReactions(
    nominationIds: string[],
    voterEmail: string,
  ): Promise<Map<string, ReactionType[]>> {
    if (nominationIds.length === 0) return new Map();

    const normalizedEmail = voterEmail.trim().toLowerCase();
    const votes = await this.upvotesRepository.find({
      where: { voterEmail: normalizedEmail, nominationId: In(nominationIds) },
    });

    const map = new Map<string, ReactionType[]>();
    for (const vote of votes) {
      const types = map.get(vote.nominationId) ?? [];
      types.push(vote.type);
      map.set(vote.nominationId, types);
    }
    return map;
  }

  toPublic(
    nomination: Nomination,
    reactionCounts: Record<ReactionType, number>,
    myReactions: ReactionType[],
  ): PublicNomination {
    return {
      id: nomination.id,
      nominatorName: nomination.isAnonymous ? null : nomination.nominatorName,
      isAnonymous: nomination.isAnonymous,
      nomineeName: nomination.nomineeName,
      nomineeEmail: nomination.nomineeEmail,
      gritCategories: nomination.gritCategories,
      reason: nomination.reason,
      roundId: nomination.roundId,
      createdAt: nomination.createdAt,
      upvoteCount: reactionCounts[ReactionType.THUMBS_UP] ?? 0,
      hasUpvoted: myReactions.includes(ReactionType.THUMBS_UP),
      reactionCounts,
      myReactions,
    };
  }
}
