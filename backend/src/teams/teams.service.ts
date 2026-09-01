import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DirectoryPerson } from '../directory/directory-person.entity';
import { DirectoryService } from '../directory/directory.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Team } from './team.entity';

export interface PublicTeamPerson {
  email: string;
  name: string;
}

export interface PublicTeam {
  id: string;
  name: string;
  manager: PublicTeamPerson | null;
  members: PublicTeamPerson[];
  createdAt: Date;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamsRepository: Repository<Team>,
    @InjectRepository(DirectoryPerson)
    private readonly directoryRepository: Repository<DirectoryPerson>,
    private readonly directoryService: DirectoryService,
  ) {}

  async listAll(): Promise<PublicTeam[]> {
    const teams = await this.teamsRepository.find({
      relations: { manager: true, members: true },
      order: { name: 'ASC' },
    });
    return teams.map((team) => this.toPublic(team));
  }

  async create(dto: CreateTeamDto): Promise<PublicTeam> {
    const name = dto.name.trim();
    await this.assertNameAvailable(name);

    const manager = dto.managerEmail ? await this.findDirectoryPersonOrThrow(dto.managerEmail) : null;

    const saved = await this.teamsRepository.save(
      this.teamsRepository.create({ name, managerId: manager?.id ?? null }),
    );
    return this.toPublic(await this.findOrThrow(saved.id));
  }

  async update(id: string, dto: UpdateTeamDto): Promise<PublicTeam> {
    const team = await this.findOrThrow(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertNameAvailable(name, id);
      team.name = name;
    }

    if (dto.managerEmail !== undefined) {
      // `team` was loaded with the `manager` relation populated, so the stale relation
      // object must be cleared too — otherwise TypeORM re-derives managerId from it on
      // save and silently ignores the FK column being set directly.
      const manager = dto.managerEmail ? await this.findDirectoryPersonOrThrow(dto.managerEmail) : null;
      team.manager = manager;
      team.managerId = manager?.id ?? null;
    }

    await this.teamsRepository.save(team);
    return this.toPublic(await this.findOrThrow(id));
  }

  async remove(id: string): Promise<void> {
    const team = await this.findOrThrow(id);
    // Members' teamId is cleared automatically by the FK's ON DELETE SET NULL.
    await this.teamsRepository.remove(team);
  }

  /** Replaces the full membership list for this team in one shot — anyone previously
   * on the team but missing from `emails` is unassigned, matching a "one team per
   * person" org-chart model rather than free-form many-to-many group membership. */
  async setMembers(id: string, emails: string[]): Promise<PublicTeam> {
    await this.findOrThrow(id);

    const normalizedEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
    const people = await this.directoryRepository.find({ where: { email: In(normalizedEmails) } });
    if (people.length !== normalizedEmails.length) {
      const found = new Set(people.map((person) => person.email));
      const missing = normalizedEmails.filter((email) => !found.has(email));
      throw new BadRequestException(
        `These people aren't in the directory yet: ${missing.join(', ')}`,
      );
    }

    await this.directoryRepository
      .createQueryBuilder()
      .update(DirectoryPerson)
      .set({ teamId: null })
      .where('teamId = :id', { id })
      .execute();

    if (people.length > 0) {
      await this.directoryRepository
        .createQueryBuilder()
        .update(DirectoryPerson)
        .set({ teamId: id })
        .where('id IN (:...ids)', { ids: people.map((person) => person.id) })
        .execute();
    }

    return this.toPublic(await this.findOrThrow(id));
  }

  private async assertNameAvailable(name: string, ignoreTeamId?: string): Promise<void> {
    const existing = await this.teamsRepository.findOne({ where: { name } });
    if (existing && existing.id !== ignoreTeamId) {
      throw new ConflictException('A team with that name already exists');
    }
  }

  private async findDirectoryPersonOrThrow(email: string): Promise<DirectoryPerson> {
    const person = await this.directoryService.findByEmail(email);
    if (!person) {
      throw new BadRequestException(`${email} isn't in the directory yet`);
    }
    return person;
  }

  private async findOrThrow(id: string): Promise<Team> {
    const team = await this.teamsRepository.findOne({
      where: { id },
      relations: { manager: true, members: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  private toPublic(team: Team): PublicTeam {
    return {
      id: team.id,
      name: team.name,
      manager: team.manager ? { email: team.manager.email, name: team.manager.name } : null,
      members: (team.members ?? [])
        .map((person) => ({ email: person.email, name: person.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      createdAt: team.createdAt,
    };
  }
}
