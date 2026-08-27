import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from './app.module';
import { GritCategory } from './common/grit-category.enum';
import { DirectoryService } from './directory/directory.service';
import { Nomination } from './nominations/nomination.entity';
import { Round, RoundStatus } from './rounds/round.entity';
import { RoundsService } from './rounds/rounds.service';
import { EMPLOYEE_ROSTER_CSV } from './seed-data/employee-roster';

/**
 * Demo/history data for a fresh install: the real company roster (so the nominate
 * form's directory picker has names to search against) plus a handful of "We Have
 * GRIT" rounds pulled from real past Slack winner announcements. Run with
 * `npm run seed` (after `npm run build`) or `node dist/seed.js` inside the backend
 * container.
 *
 * The exact year for each round below wasn't visible in the source Slack messages
 * (only a time-of-day), so 2025 is a placeholder — correct the `eventDate` values if
 * that's wrong.
 *
 * Safe to re-run: the roster import upserts by email, and rounds are matched/skipped
 * by title.
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
    title: 'March 2025 We Have GRIT',
    eventDate: '2025-03-01',
    winnerEmail: 'dbrothers@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Dave Brothers',
        nomineeEmail: 'dbrothers@bitwarden.com',
        gritCategories: [GritCategory.RESPONSIBILITY],
        reason:
          "Dave exemplifies what it means to do the right thing for our customers, even when the work is complex and unglamorous. Over the past several months, Dave led the effort to resolve a long-standing limitation in our single sign-on offering: our SSO implementation could not horizontally scale in the Bitwarden cloud due to a data synchronization constraint across running instances. This was a known risk for years, and Dave took ownership of delivering the solution. Working with the Auth team (Todd, Brad, and Ope), Dave drove the rollout of a new caching pattern that now allows our SSO infrastructure to scale out dynamically as traffic demands. He didn't cut corners or settle for a workaround -- he delivered the architecture our customers needed for reliable, scalable access to their vaults. What makes this especially significant: SSO was the final platform component that lacked horizontal scaling capabilities. By completing this work, Dave helped ensure that our entire platform -- cloud and self-host -- can now scale to meet the needs of any customer. That's the definition of delivering our best work and doing right by our users. Dave took responsibility for a hard, high-stakes problem and saw it through to a result that makes Bitwarden more reliable at scale for every customer we serve.",
      },
    ],
  },
  {
    title: 'June 2025 We Have GRIT',
    eventDate: '2025-06-01',
    winnerEmail: 'fmaccaroni@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Federico Maccaroni',
        nomineeEmail: 'fmaccaroni@bitwarden.com',
        gritCategories: [GritCategory.GRIT, GritCategory.GRATITUDE],
        reason:
          "Rico embraces GRIT values here at Bitwarden -his daily work activities and approach includes passion, perseverance, and adaptability to help push Bitwarden forward. Rico is truly an awesome teammate. He's responsive, passionate, and extremely helpful. There's a reason the chat goes wild for Rico. He is someone I'm grateful to have around.",
      },
    ],
  },
  {
    title: 'July 2025 We Have GRIT',
    eventDate: '2025-07-01',
    winnerEmail: 'skakar@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Sami Kakar',
        nomineeEmail: 'skakar@bitwarden.com',
        gritCategories: [GritCategory.GRIT, GritCategory.TRUST],
        reason:
          "Sami shows passion, perseverance, and adaptability to help push Bitwarden forward. Sami jumps in to help and is a true partner that I can count on.",
      },
    ],
  },
  {
    title: 'August 2025 We Have GRIT',
    eventDate: '2025-08-01',
    winnerEmail: 'lleigh@bitwarden.com',
    nominations: [
      {
        nomineeName: 'Lima Leigh',
        nomineeEmail: 'lleigh@bitwarden.com',
        gritCategories: [GritCategory.RESPONSIBILITY],
        reason:
          "Lima's a consummate team player on the Comms team and annually takes the initiative to spearhead the Bitwarden event strategy for RSA and the Open Source Security Summit. She's always willing to lend a helping hand on ancillary projects, has a discerning eye for editing and continues to be an excellent project manager wrangling multiple vendors and stakeholders for streamlined event orchestration.",
      },
    ],
  },
];

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  const roundRepo = app.get<Repository<Round>>(getRepositoryToken(Round));
  const nominationRepo = app.get<Repository<Nomination>>(getRepositoryToken(Nomination));
  const directoryService = app.get(DirectoryService);
  const roundsService = app.get(RoundsService);

  const rosterSummary = await directoryService.importFromCsv(EMPLOYEE_ROSTER_CSV);
  console.log(
    `Imported employee roster: ${rosterSummary.imported} imported, ${rosterSummary.updated} updated, ${rosterSummary.skipped} skipped of ${rosterSummary.totalRows} rows`,
  );

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
