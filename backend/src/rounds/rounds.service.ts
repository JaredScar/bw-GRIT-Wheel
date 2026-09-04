import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nomination } from '../nominations/nomination.entity';
import { SlackNotificationService } from '../notifications/slack-notification.service';
import { CreateRoundDto } from './dto/create-round.dto';
import { Round, RoundStatus, WheelMode } from './round.entity';

export interface WheelEntry {
  nomineeName: string;
  nomineeEmail: string;
  nominationIds: string[];
}

export interface SpinResult {
  round: Round;
  entries: WheelEntry[];
  winner: WheelEntry;
}

@Injectable()
export class RoundsService {
  constructor(
    @InjectRepository(Round)
    private readonly roundsRepository: Repository<Round>,
    @InjectRepository(Nomination)
    private readonly nominationsRepository: Repository<Nomination>,
    private readonly slackNotificationService: SlackNotificationService,
  ) {}

  async findAll(): Promise<Round[]> {
    return this.roundsRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Round> {
    const round = await this.roundsRepository.findOne({ where: { id } });
    if (!round) {
      throw new NotFoundException('Round not found');
    }
    return round;
  }

  async getOrCreateCurrentOpenRound(): Promise<Round> {
    const openRound = await this.roundsRepository.findOne({
      where: { status: RoundStatus.OPEN },
      order: { createdAt: 'DESC' },
    });

    if (openRound) {
      return openRound;
    }

    const round = this.roundsRepository.create({
      title: `All-Hands GRIT Round – ${new Date().toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })}`,
      status: RoundStatus.OPEN,
    });

    return this.roundsRepository.save(round);
  }

  async getCurrentOpenRound(): Promise<Round | null> {
    return this.roundsRepository.findOne({
      where: { status: RoundStatus.OPEN },
      order: { createdAt: 'DESC' },
    });
  }

  async createRound(dto: CreateRoundDto): Promise<Round> {
    const openRounds = await this.roundsRepository.find({ where: { status: RoundStatus.OPEN } });
    for (const round of openRounds) {
      round.status = RoundStatus.CLOSED;
    }
    if (openRounds.length > 0) {
      await this.roundsRepository.save(openRounds);
    }

    const round = this.roundsRepository.create({
      title: dto.title.trim(),
      eventDate: dto.eventDate ?? null,
      status: RoundStatus.OPEN,
    });

    const saved = await this.roundsRepository.save(round);
    void this.slackNotificationService.notifyRoundOpened(saved.title);
    return saved;
  }

  async findWinsByEmail(email: string): Promise<Round[]> {
    const normalizedEmail = email.trim().toLowerCase();
    return this.roundsRepository.find({
      where: { winnerNomineeEmail: normalizedEmail },
      order: { spunAt: 'DESC' },
    });
  }

  /**
   * The round this nomination was recorded as the winning entry for, if any. Guards edits:
   * the nomination that produced an announced winner can't be deleted or re-pointed at a
   * different person without the round history contradicting what was announced.
   */
  async findRoundDecidedBy(nominationId: string): Promise<Round | null> {
    return this.roundsRepository.findOne({ where: { winnerNominationId: nominationId } });
  }

  async getWheelEntries(roundId: string): Promise<WheelEntry[]> {
    const nominations = await this.nominationsRepository.find({ where: { roundId } });

    const byNominee = new Map<string, WheelEntry>();
    for (const nomination of nominations) {
      const key = nomination.nomineeEmail.toLowerCase();
      const existing = byNominee.get(key);
      if (existing) {
        existing.nominationIds.push(nomination.id);
      } else {
        byNominee.set(key, {
          nomineeName: nomination.nomineeName,
          nomineeEmail: nomination.nomineeEmail,
          nominationIds: [nomination.id],
        });
      }
    }

    return Array.from(byNominee.values());
  }

  async spinWheel(roundId: string, weighted = false): Promise<SpinResult> {
    const round = await this.findOne(roundId);

    if (round.status !== RoundStatus.OPEN) {
      throw new BadRequestException('Only an open round can be spun');
    }

    const entries = await this.getWheelEntries(roundId);
    if (entries.length === 0) {
      throw new BadRequestException('This round has no nominations to spin for');
    }

    const winner = weighted ? this.pickWeightedWinner(entries) : this.pickUniformWinner(entries);

    round.status = RoundStatus.COMPLETED;
    round.winnerNomineeName = winner.nomineeName;
    round.winnerNomineeEmail = winner.nomineeEmail;
    round.winnerNominationId = winner.nominationIds[0];
    round.wheelMode = weighted ? WheelMode.WEIGHTED : WheelMode.EQUAL;
    round.spunAt = new Date();

    const saved = await this.roundsRepository.save(round);

    void this.slackNotificationService.notifyWinner({
      roundTitle: saved.title,
      winnerName: winner.nomineeName,
    });

    return { round: saved, entries, winner };
  }

  private pickUniformWinner(entries: WheelEntry[]): WheelEntry {
    return entries[Math.floor(Math.random() * entries.length)];
  }

  private pickWeightedWinner(entries: WheelEntry[]): WheelEntry {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.nominationIds.length, 0);
    let roll = Math.random() * totalWeight;
    for (const entry of entries) {
      roll -= entry.nominationIds.length;
      if (roll < 0) return entry;
    }
    return entries[entries.length - 1];
  }
}
