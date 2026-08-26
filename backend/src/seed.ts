import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { GritCategory } from './common/grit-category.enum';
import { DirectoryPerson } from './directory/directory-person.entity';
import { Nomination } from './nominations/nomination.entity';
import { Round, RoundStatus } from './rounds/round.entity';
import { RoundsService } from './rounds/rounds.service';

/**
 * Example/demo data for a handful of "completed" past rounds (with winners),
 * so a fresh install has something to look at right away. Run with
 * `npm run seed` (after `npm run build`) or `node dist/seed.js` inside the
 * backend container.
 *
 * All names, emails, and nomination text below are fictional placeholders —
 * replace them with your own organization's real history if you'd like, or
 * skip this script entirely: import a real CSV roster from `/admin` and
 * start creating rounds from there instead.
 *
 * Safe to re-run: rounds are matched/skipped by title.
 */

const ARCHIVE_NOMINATOR_NAME = 'GRIT Award Archive';
const ARCHIVE_NOMINATOR_EMAIL = 'grit-archive@bitwarden.com';

interface SeedNomination {
  nomineeName: string;
  nomineeEmail: string;
  gritCategories: GritCategory[];
  reason: string;
}

interface SeedRound {
  title: string;
  eventDate: string;
  winnerEmail: string;
  nominations: SeedNomination[];
}

const NEXT_OPEN_ROUND_TITLE = 'Next All-Hands';

const seedRounds: SeedRound[] = [
  {
    title: 'Example Round 1',
    eventDate: '2025-01-15',
    winnerEmail: 'alex.rivera@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Alex Rivera',
        nomineeEmail: 'alex.rivera@bitwarden.com',
        gritCategories: [GritCategory.INNOVATION],
        reason:
          'Alex proposed a creative solution to a long-standing bottleneck in our release process and volunteered to prototype it over a weekend. The idea is now part of how the whole team ships.',
      },
    ],
  },
  {
    title: 'Example Round 2',
    eventDate: '2025-02-12',
    winnerEmail: 'jordan.kim@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Jordan Kim',
        nomineeEmail: 'jordan.kim@bitwarden.com',
        gritCategories: [GritCategory.RESPONSIBILITY],
        reason:
          'Jordan owned a tricky customer-facing bug end to end, including the uncomfortable parts of communicating the impact and timeline, and saw it through to a real fix instead of a quick patch.',
      },
    ],
  },
  {
    title: 'Example Round 3',
    eventDate: '2025-03-19',
    winnerEmail: 'sam.patel@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Sam Patel',
        nomineeEmail: 'sam.patel@bitwarden.com',
        gritCategories: [GritCategory.GRIT, GritCategory.GRATITUDE],
        reason:
          'Sam kept pushing through a genuinely difficult migration project without losing momentum or morale for the rest of the team, and was always the first to jump in and help teammates with a great attitude.',
      },
    ],
  },
  {
    title: 'Example Round 4',
    eventDate: '2025-04-16',
    winnerEmail: 'morgan.chen@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Morgan Chen',
        nomineeEmail: 'morgan.chen@bitwarden.com',
        gritCategories: [GritCategory.TRUST, GritCategory.GRIT],
        reason:
          'Morgan is transparent with stakeholders even when the news is bad, and showed real perseverance getting a stalled project unstuck after months of it being deprioritized.',
      },
    ],
  },
  {
    title: 'Example Round 5',
    eventDate: '2025-05-14',
    winnerEmail: 'taylor.nguyen@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Taylor Nguyen',
        nomineeEmail: 'taylor.nguyen@bitwarden.com',
        gritCategories: [GritCategory.RESPONSIBILITY],
        reason:
          'Taylor took ownership of coordinating a cross-team project with several external vendors and kept everyone aligned through a chaotic timeline.',
      },
    ],
  },
];

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roundRepo = app.get<Repository<Round>>(getRepositoryToken(Round));
  const nominationRepo = app.get<Repository<Nomination>>(getRepositoryToken(Nomination));
  const directoryRepo = app.get<Repository<DirectoryPerson>>(getRepositoryToken(DirectoryPerson));
  const roundsService = app.get(RoundsService);

  // Real deployments populate this via CSV import from /admin; the seed script inserts
  // its own fictional nominees directly so the example rounds below have someone valid
  // to point at.
  const seedPeople = new Map<string, string>();
  for (const seed of seedRounds) {
    for (const nomination of seed.nominations) {
      seedPeople.set(nomination.nomineeEmail, nomination.nomineeName);
    }
  }
  for (const [email, name] of seedPeople) {
    const existing = await directoryRepo.findOne({ where: { email } });
    if (!existing) {
      await directoryRepo.save(directoryRepo.create({ email, name }));
    }
  }

  for (const seed of seedRounds) {
    const existing = await roundRepo.findOne({ where: { title: seed.title } });
    if (existing) {
      console.log(`Skipping "${seed.title}" (already seeded)`);
      continue;
    }

    const round = await roundRepo.save(
      roundRepo.create({
        title: seed.title,
        eventDate: seed.eventDate,
        status: RoundStatus.OPEN,
      }),
    );

    for (const nomination of seed.nominations) {
      await nominationRepo.save(
        nominationRepo.create({
          nominatorName: ARCHIVE_NOMINATOR_NAME,
          nominatorEmail: ARCHIVE_NOMINATOR_EMAIL,
          isAnonymous: true,
          nomineeName: nomination.nomineeName,
          nomineeEmail: nomination.nomineeEmail,
          gritCategories: nomination.gritCategories,
          reason: nomination.reason,
          roundId: round.id,
        }),
      );
    }

    const result = await roundsService.spinWheel(round.id);

    if (result.winner.nomineeEmail.toLowerCase() !== seed.winnerEmail.toLowerCase()) {
      throw new Error(
        `Unexpected winner for "${seed.title}": got ${result.winner.nomineeEmail}, expected ${seed.winnerEmail}`,
      );
    }

    console.log(`Seeded "${seed.title}" -> winner: ${result.winner.nomineeName}`);
  }

  const nextRound = await roundRepo.findOne({ where: { title: NEXT_OPEN_ROUND_TITLE } });
  if (!nextRound) {
    const created = await roundsService.createRound({ title: NEXT_OPEN_ROUND_TITLE });
    console.log(`Opened new round for upcoming nominations: "${created.title}"`);
  }

  await app.close();
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
