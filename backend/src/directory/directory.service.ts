import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DirectoryPerson } from './directory-person.entity';

export interface DirectoryImportSummary {
  totalRows: number;
  imported: number;
  updated: number;
  skipped: number;
}

const BITWARDEN_EMAIL_SUFFIX = '@bitwarden.com';

const EMAIL_HEADER_ALIASES = ['email', 'e-mail', 'e-mail address', 'email address'];
const NAME_HEADER_ALIASES = [
  'fullname',
  'full name',
  'real name',
  'realname',
  'name',
  'displayname',
  'display name',
];
const STATUS_HEADER_ALIASES = ['status', 'account status'];
const BOT_HEADER_ALIASES = ['bots', 'bot', 'is_bot', 'isbot', 'is bot'];
const TRUTHY_FLAG_VALUES = ['true', '1', 'yes', 'x'];

@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);

  constructor(
    @InjectRepository(DirectoryPerson)
    private readonly directoryRepository: Repository<DirectoryPerson>,
  ) {}

  async listAll(): Promise<DirectoryPerson[]> {
    return this.directoryRepository.find({ order: { name: 'ASC' } });
  }

  async findByEmail(email: string): Promise<DirectoryPerson | null> {
    return this.directoryRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async count(): Promise<number> {
    return this.directoryRepository.count();
  }

  /**
   * Imports/updates the nominee roster from a Slack "export member list" CSV. Column
   * names are matched case-insensitively against a few common aliases rather than a
   * single fixed header, since Slack's export format varies by plan/workspace.
   */
  async importFromCsv(csvText: string): Promise<DirectoryImportSummary> {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
      throw new BadRequestException('The CSV file is empty');
    }

    const [headerRow, ...dataRows] = rows;
    const header = headerRow.map((cell) => cell.trim().toLowerCase());

    const emailIndex = findColumn(header, EMAIL_HEADER_ALIASES);
    if (emailIndex === -1) {
      throw new BadRequestException(
        `Could not find an email column in the CSV header (found columns: ${headerRow.join(', ')})`,
      );
    }
    const nameIndex = findColumn(header, NAME_HEADER_ALIASES);
    const statusIndex = findColumn(header, STATUS_HEADER_ALIASES);
    const botIndex = findColumn(header, BOT_HEADER_ALIASES);

    const summary: DirectoryImportSummary = {
      totalRows: dataRows.length,
      imported: 0,
      updated: 0,
      skipped: 0,
    };

    for (const row of dataRows) {
      if (row.length === 0 || row.every((cell) => cell.trim() === '')) {
        continue;
      }

      const rawEmail = (row[emailIndex] ?? '').trim().toLowerCase();
      if (!rawEmail || !rawEmail.endsWith(BITWARDEN_EMAIL_SUFFIX)) {
        summary.skipped++;
        continue;
      }

      if (statusIndex !== -1) {
        const status = (row[statusIndex] ?? '').trim().toLowerCase();
        if (status && status !== 'active') {
          summary.skipped++;
          continue;
        }
      }

      if (botIndex !== -1) {
        const botFlag = (row[botIndex] ?? '').trim().toLowerCase();
        if (TRUTHY_FLAG_VALUES.includes(botFlag)) {
          summary.skipped++;
          continue;
        }
      }

      const rawName = nameIndex !== -1 ? (row[nameIndex] ?? '').trim() : '';
      const name = rawName || fallbackNameFromEmail(rawEmail);

      const existing = await this.directoryRepository.findOne({ where: { email: rawEmail } });
      if (existing) {
        if (existing.name !== name) {
          existing.name = name;
          await this.directoryRepository.save(existing);
          summary.updated++;
        }
      } else {
        await this.directoryRepository.save(this.directoryRepository.create({ email: rawEmail, name }));
        summary.imported++;
      }
    }

    this.logger.log(
      `Directory import: ${summary.imported} imported, ${summary.updated} updated, ${summary.skipped} skipped of ${summary.totalRows} rows`,
    );

    return summary;
  }
}

/**
 * Bitwarden email addresses are firstinitial+lastname@bitwarden.com, so when there is
 * no display name on file, dropping the first character of the local part recovers a
 * reasonable name to show instead of a raw email address (jscarito -> Scarito).
 */
function fallbackNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const rest = localPart.slice(1);
  if (!rest) return localPart || email;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((column) => aliases.includes(column));
}

/** Minimal CSV parser: handles quoted fields, escaped quotes (""), and commas inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}
