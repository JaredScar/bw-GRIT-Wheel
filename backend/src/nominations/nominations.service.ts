import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { GritCategory } from '../common/grit-category.enum';
import { SlackNotificationService } from '../notifications/slack-notification.service';
import { RoundsService } from '../rounds/rounds.service';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { NominationUpvote } from './nomination-upvote.entity';
import { Nomination } from './nomination.entity';

export interface PublicNomination {
  id: string;
  nominatorName: string | null;
  isAnonymous: boolean;
  nomineeName: string;
  gritCategories: GritCategory[];
  reason: string;
  roundId: string;
  createdAt: Date;
  upvoteCount: number;
  hasUpvoted: boolean;
  canUpvote: boolean;
}

export interface ToggleUpvoteResult {
  upvoteCount: number;
  hasUpvoted: boolean;
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
  ) {}

  async create(dto: CreateNominationDto, nominatorEmail: string): Promise<PublicNomination> {
    const currentRound = await this.roundsService.getOrCreateCurrentOpenRound();

    const nomination = this.nominationsRepository.create({
      nominatorName: dto.nominatorName.trim(),
      nominatorEmail: nominatorEmail.trim().toLowerCase(),
      isAnonymous: dto.isAnonymous ?? false,
      nomineeName: dto.nomineeName.trim(),
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

    return this.toPublic(saved, 0, false, true);
  }

  async findAll(filters: {
    roundId?: string;
    gritCategory?: GritCategory;
    nomineeName?: string;
    viewerEmail?: string;
  }): Promise<PublicNomination[]> {
    const qb = this.nominationsRepository.createQueryBuilder('n');

    if (filters.roundId) {
      qb.andWhere('n.roundId = :roundId', { roundId: filters.roundId });
    }
    if (filters.gritCategory) {
      qb.andWhere(':category = ANY(n.gritCategories)', { category: filters.gritCategory });
    }
    if (filters.nomineeName) {
      qb.andWhere('LOWER(TRIM(n.nomineeName)) = LOWER(TRIM(:nomineeName))', {
        nomineeName: filters.nomineeName,
      });
    }
    qb.orderBy('n.createdAt', 'DESC');

    const nominations = await qb.getMany();

    if (nominations.length === 0) {
      return [];
    }

    const ids = nominations.map((n) => n.id);
    const countMap = await this.getUpvoteCounts(ids);
    const votedSet = filters.viewerEmail
      ? await this.getVotedSet(ids, filters.viewerEmail)
      : new Set<string>();
    const currentRound = await this.roundsService.getCurrentOpenRound();

    return nominations.map((n) =>
      this.toPublic(
        n,
        countMap.get(n.id) ?? 0,
        votedSet.has(n.id),
        currentRound?.id === n.roundId,
      ),
    );
  }

  async findOnePublic(id: string, viewerEmail?: string): Promise<PublicNomination> {
    const nomination = await this.nominationsRepository.findOne({ where: { id } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    const countMap = await this.getUpvoteCounts([id]);
    const votedSet = viewerEmail ? await this.getVotedSet([id], viewerEmail) : new Set<string>();
    const currentRound = await this.roundsService.getCurrentOpenRound();

    return this.toPublic(
      nomination,
      countMap.get(id) ?? 0,
      votedSet.has(id),
      currentRound?.id === nomination.roundId,
    );
  }

  async findEntitiesByRound(roundId: string): Promise<Nomination[]> {
    return this.nominationsRepository.find({ where: { roundId } });
  }

  async toggleUpvote(nominationId: string, voterEmail: string): Promise<ToggleUpvoteResult> {
    const nomination = await this.nominationsRepository.findOne({ where: { id: nominationId } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    const currentRound = await this.roundsService.getCurrentOpenRound();
    if (!currentRound || nomination.roundId !== currentRound.id) {
      throw new BadRequestException(
        'You can only react to nominations from the current, still-open round',
      );
    }

    const normalizedEmail = voterEmail.trim().toLowerCase();
    const existing = await this.upvotesRepository.findOne({
      where: { nominationId, voterEmail: normalizedEmail },
    });

    if (existing) {
      await this.upvotesRepository.delete(existing.id);
    } else {
      await this.upvotesRepository.save(
        this.upvotesRepository.create({ nominationId, voterEmail: normalizedEmail }),
      );
    }

    const upvoteCount = await this.upvotesRepository.count({ where: { nominationId } });
    return { upvoteCount, hasUpvoted: !existing };
  }

  private async getUpvoteCounts(nominationIds: string[]): Promise<Map<string, number>> {
    if (nominationIds.length === 0) return new Map();

    const rows = await this.upvotesRepository
      .createQueryBuilder('upvote')
      .select('upvote.nominationId', 'nominationId')
      .addSelect('COUNT(*)', 'count')
      .where('upvote.nominationId IN (:...nominationIds)', { nominationIds })
      .groupBy('upvote.nominationId')
      .getRawMany<{ nominationId: string; count: string }>();

    return new Map(rows.map((row) => [row.nominationId, parseInt(row.count, 10)]));
  }

  private async getVotedSet(nominationIds: string[], voterEmail: string): Promise<Set<string>> {
    if (nominationIds.length === 0) return new Set();

    const normalizedEmail = voterEmail.trim().toLowerCase();
    const votes = await this.upvotesRepository.find({
      where: { voterEmail: normalizedEmail, nominationId: In(nominationIds) },
    });

    return new Set(votes.map((v) => v.nominationId));
  }

  toPublic(
    nomination: Nomination,
    upvoteCount: number,
    hasUpvoted: boolean,
    canUpvote: boolean,
  ): PublicNomination {
    return {
      id: nomination.id,
      nominatorName: nomination.isAnonymous ? null : nomination.nominatorName,
      isAnonymous: nomination.isAnonymous,
      nomineeName: nomination.nomineeName,
      gritCategories: nomination.gritCategories,
      reason: nomination.reason,
      roundId: nomination.roundId,
      createdAt: nomination.createdAt,
      upvoteCount,
      hasUpvoted,
      canUpvote,
    };
  }
}
