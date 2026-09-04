import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { SessionUser } from '../auth/session-user';
import { GritCategory } from '../common/grit-category.enum';
import { DirectoryService } from '../directory/directory.service';
import { SlackNotificationService } from '../notifications/slack-notification.service';
import { RoundsService } from '../rounds/rounds.service';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { UpdateNominationDto } from './dto/update-nomination.dto';
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
  /** Non-null once an admin has corrected this nomination; shown as an "edited" marker. */
  editedAt: Date | null;
  /** Only ever non-null in the admin-only deleted view — the feed never returns these. */
  deletedAt: Date | null;
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

function sameCategories(a: GritCategory[], b: GritCategory[]): boolean {
  return a.length === b.length && a.every((category) => b.includes(category));
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
    let nominee = await this.directoryService.findByEmail(dto.nomineeEmail);
    if (!nominee) {
      if (!dto.nomineeName?.trim()) {
        throw new BadRequestException('Please select the nominee from the list');
      }
      nominee = await this.directoryService.addPerson(dto.nomineeEmail, dto.nomineeName);
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
    /** Admin-only: also return soft-deleted nominations so they can be reviewed/restored. */
    includeDeleted?: boolean;
  }): Promise<PublicNomination[]> {
    const qb = this.nominationsRepository.createQueryBuilder('n');

    if (filters.includeDeleted) {
      qb.withDeleted();
    }
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

  /**
   * Admin correction of a nomination — fixing a typo, a wrong nominee picked from the
   * directory, or the wrong GRIT values ticked. Only the fields present on the DTO are
   * touched, and the edit is stamped so the feed can show it was changed after the fact.
   */
  async adminUpdate(
    id: string,
    dto: UpdateNominationDto,
    admin: SessionUser,
  ): Promise<PublicNomination> {
    const nomination = await this.nominationsRepository.findOne({ where: { id } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    let changed = false;

    if (dto.nomineeEmail !== undefined) {
      const normalizedEmail = dto.nomineeEmail.trim().toLowerCase();
      if (normalizedEmail !== nomination.nomineeEmail.trim().toLowerCase()) {
        await this.assertNotWinningNomination(
          id,
          "This nomination decided a round winner, so it can't be pointed at a different person. Its wording and GRIT values can still be corrected.",
        );

        let nominee = await this.directoryService.findByEmail(normalizedEmail);
        if (!nominee) {
          if (!dto.nomineeName?.trim()) {
            throw new BadRequestException('Please select the nominee from the list');
          }
          nominee = await this.directoryService.addPerson(normalizedEmail, dto.nomineeName);
        }

        nomination.nomineeName = nominee.name;
        nomination.nomineeEmail = nominee.email;
        changed = true;
      }
    }

    if (dto.gritCategories !== undefined && !sameCategories(nomination.gritCategories, dto.gritCategories)) {
      nomination.gritCategories = dto.gritCategories;
      changed = true;
    }

    if (dto.reason !== undefined && dto.reason.trim() !== nomination.reason) {
      nomination.reason = dto.reason.trim();
      changed = true;
    }

    if (dto.isAnonymous !== undefined && dto.isAnonymous !== nomination.isAnonymous) {
      nomination.isAnonymous = dto.isAnonymous;
      changed = true;
    }

    // A no-op save shouldn't brand the nomination as edited — an admin can open the dialog,
    // look, and close it without leaving a mark on someone else's recognition.
    if (!changed) {
      return this.findOnePublic(id, admin.email);
    }

    nomination.editedAt = new Date();
    nomination.editedByEmail = admin.email.trim().toLowerCase();
    await this.nominationsRepository.save(nomination);

    return this.findOnePublic(id, admin.email);
  }

  /**
   * Soft delete: the row stays put with `deletedAt` set, so it drops out of the feed, the
   * wheel, profiles and the leaderboard, but a mistaken removal is one click from being
   * undone. Reactions are left attached and come back with it on restore.
   */
  async adminDelete(id: string, admin: SessionUser): Promise<void> {
    const nomination = await this.nominationsRepository.findOne({ where: { id } });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }

    await this.assertNotWinningNomination(
      id,
      "This nomination decided a round winner and can't be deleted. Correct its wording instead if something's wrong with it.",
    );

    nomination.deletedByEmail = admin.email.trim().toLowerCase();
    await this.nominationsRepository.save(nomination);
    await this.nominationsRepository.softDelete(id);
  }

  /** Undoes {@link adminDelete}, putting the nomination and its reactions back in the feed. */
  async adminRestore(id: string, admin: SessionUser): Promise<PublicNomination> {
    const nomination = await this.nominationsRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!nomination) {
      throw new NotFoundException('Nomination not found');
    }
    if (!nomination.deletedAt) {
      throw new BadRequestException('This nomination has not been deleted');
    }

    await this.nominationsRepository.restore(id);
    await this.nominationsRepository.update(id, { deletedByEmail: null });

    return this.findOnePublic(id, admin.email);
  }

  private async assertNotWinningNomination(id: string, message: string): Promise<void> {
    const decidedRound = await this.roundsService.findRoundDecidedBy(id);
    if (decidedRound) {
      throw new BadRequestException(message);
    }
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
      editedAt: nomination.editedAt ?? null,
      deletedAt: nomination.deletedAt ?? null,
      upvoteCount: reactionCounts[ReactionType.THUMBS_UP] ?? 0,
      hasUpvoted: myReactions.includes(ReactionType.THUMBS_UP),
      reactionCounts,
      myReactions,
    };
  }
}
