import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SessionUser } from '../auth/session-user';
import { GritCategory } from '../common/grit-category.enum';
import { DirectoryService } from '../directory/directory.service';
import { SlackNotificationService } from '../notifications/slack-notification.service';
import { RoundsService } from '../rounds/rounds.service';
import { Nomination } from './nomination.entity';
import { NominationUpvote } from './nomination-upvote.entity';
import { NominationsService } from './nominations.service';

const ADMIN = { id: 'admin-1', email: 'Admin@bitwarden.com' } as SessionUser;

function buildNomination(overrides: Partial<Nomination> = {}): Nomination {
  return {
    id: 'nom-1',
    nominatorName: 'Riley Nominator',
    nominatorEmail: 'rnominator@bitwarden.com',
    isAnonymous: false,
    nomineeName: 'Original Nominee',
    nomineeEmail: 'original@bitwarden.com',
    gritCategories: [GritCategory.TRUST],
    reason: 'They did a genuinely excellent thing.',
    roundId: 'round-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    editedAt: null,
    editedByEmail: null,
    deletedAt: null,
    deletedByEmail: null,
    ...overrides,
  } as Nomination;
}

interface Harness {
  service: NominationsService;
  nominations: jest.Mocked<Pick<Repository<Nomination>, 'findOne' | 'save' | 'softDelete' | 'restore' | 'update'>>;
  roundsService: { findRoundDecidedBy: jest.Mock };
  directoryService: { findByEmail: jest.Mock; addPerson: jest.Mock };
}

function createHarness(stored: Nomination): Harness {
  // findOne always reflects the latest saved state, so the findOnePublic() call at the end
  // of a mutation sees what was written rather than the original row.
  let current = stored;

  const nominations = {
    findOne: jest.fn(async () => current),
    save: jest.fn(async (entity: Nomination) => {
      current = entity;
      return entity;
    }),
    softDelete: jest.fn(async () => ({ affected: 1 })),
    restore: jest.fn(async () => ({ affected: 1 })),
    update: jest.fn(async (_id: string, patch: Partial<Nomination>) => {
      current = { ...current, ...patch } as Nomination;
      return { affected: 1 };
    }),
  } as unknown as Harness['nominations'];

  const upvotes = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => []),
    })),
    find: jest.fn(async () => []),
  } as unknown as Repository<NominationUpvote>;

  const roundsService = { findRoundDecidedBy: jest.fn(async () => null) };
  const directoryService = { findByEmail: jest.fn(async () => null), addPerson: jest.fn() };
  const slack = { notifyNewNomination: jest.fn() };

  const service = new NominationsService(
    nominations as unknown as Repository<Nomination>,
    upvotes,
    roundsService as unknown as RoundsService,
    slack as unknown as SlackNotificationService,
    directoryService as unknown as DirectoryService,
  );

  return { service, nominations, roundsService, directoryService };
}

describe('NominationsService moderation', () => {
  describe('adminUpdate', () => {
    it('applies the edit and stamps who changed it', async () => {
      const { service, nominations } = createHarness(buildNomination());

      const result = await service.adminUpdate(
        'nom-1',
        { reason: '  A corrected, much clearer reason.  ' },
        ADMIN,
      );

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.reason).toBe('A corrected, much clearer reason.');
      expect(saved.editedByEmail).toBe('admin@bitwarden.com');
      expect(saved.editedAt).toBeInstanceOf(Date);
      expect(result.editedAt).toBeInstanceOf(Date);
    });

    it('leaves fields the caller omitted alone', async () => {
      const { service, nominations } = createHarness(buildNomination());

      await service.adminUpdate('nom-1', { gritCategories: [GritCategory.GRIT] }, ADMIN);

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.gritCategories).toEqual([GritCategory.GRIT]);
      expect(saved.reason).toBe('They did a genuinely excellent thing.');
      expect(saved.nomineeEmail).toBe('original@bitwarden.com');
      expect(saved.isAnonymous).toBe(false);
    });

    it('never reattributes the nomination to a different nominator', async () => {
      const { service, nominations } = createHarness(buildNomination());

      // The nominator is not on UpdateNominationDto at all, so even a hand-rolled request
      // carrying one is a no-op rather than a reattribution.
      const result = await service.adminUpdate(
        'nom-1',
        { nominatorEmail: 'someoneelse@bitwarden.com', reason: 'A corrected reason here.' } as never,
        ADMIN,
      );

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.nominatorEmail).toBe('rnominator@bitwarden.com');
      expect(result.nominatorName).toBe('Riley Nominator');
    });

    it('does not mark a nomination edited when nothing actually changed', async () => {
      const { service, nominations } = createHarness(buildNomination());

      const result = await service.adminUpdate(
        'nom-1',
        {
          reason: 'They did a genuinely excellent thing.',
          gritCategories: [GritCategory.TRUST],
          nomineeEmail: 'ORIGINAL@bitwarden.com',
          isAnonymous: false,
        },
        ADMIN,
      );

      expect(nominations.save).not.toHaveBeenCalled();
      expect(result.editedAt).toBeNull();
    });

    it('repoints the nominee at an existing directory person', async () => {
      const { service, nominations, directoryService } = createHarness(buildNomination());
      directoryService.findByEmail.mockResolvedValue({
        email: 'correct@bitwarden.com',
        name: 'Correct Person',
      });

      await service.adminUpdate('nom-1', { nomineeEmail: 'correct@bitwarden.com' }, ADMIN);

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.nomineeEmail).toBe('correct@bitwarden.com');
      expect(saved.nomineeName).toBe('Correct Person');
      expect(directoryService.addPerson).not.toHaveBeenCalled();
    });

    it('adds a nominee who is not in the directory yet, given a name', async () => {
      const { service, directoryService } = createHarness(buildNomination());
      directoryService.findByEmail.mockResolvedValue(null);
      directoryService.addPerson.mockResolvedValue({
        email: 'newhire@bitwarden.com',
        name: 'New Hire',
      });

      await service.adminUpdate(
        'nom-1',
        { nomineeEmail: 'newhire@bitwarden.com', nomineeName: 'New Hire' },
        ADMIN,
      );

      expect(directoryService.addPerson).toHaveBeenCalledWith('newhire@bitwarden.com', 'New Hire');
    });

    it('refuses an unknown nominee with no name to create them under', async () => {
      const { service, directoryService } = createHarness(buildNomination());
      directoryService.findByEmail.mockResolvedValue(null);

      await expect(
        service.adminUpdate('nom-1', { nomineeEmail: 'ghost@bitwarden.com' }, ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to repoint the nomination that decided a round winner', async () => {
      const { service, roundsService, directoryService } = createHarness(buildNomination());
      roundsService.findRoundDecidedBy.mockResolvedValue({ id: 'round-1' });
      directoryService.findByEmail.mockResolvedValue({
        email: 'correct@bitwarden.com',
        name: 'Correct Person',
      });

      await expect(
        service.adminUpdate('nom-1', { nomineeEmail: 'correct@bitwarden.com' }, ADMIN),
      ).rejects.toThrow('decided a round winner');
    });

    it('still allows wording fixes on the nomination that decided a winner', async () => {
      const { service, roundsService, nominations } = createHarness(buildNomination());
      roundsService.findRoundDecidedBy.mockResolvedValue({ id: 'round-1' });

      await service.adminUpdate('nom-1', { reason: 'Corrected spelling of their name.' }, ADMIN);

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.reason).toBe('Corrected spelling of their name.');
    });

    it('404s on a nomination that does not exist', async () => {
      const { service, nominations } = createHarness(buildNomination());
      nominations.findOne.mockResolvedValue(null);

      await expect(service.adminUpdate('missing', { reason: 'x'.repeat(20) }, ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('adminDelete', () => {
    it('soft deletes and records who did it', async () => {
      const { service, nominations } = createHarness(buildNomination());

      await service.adminDelete('nom-1', ADMIN);

      const saved = nominations.save.mock.calls[0][0] as Nomination;
      expect(saved.deletedByEmail).toBe('admin@bitwarden.com');
      expect(nominations.softDelete).toHaveBeenCalledWith('nom-1');
    });

    it('refuses to delete the nomination that decided a round winner', async () => {
      const { service, nominations, roundsService } = createHarness(buildNomination());
      roundsService.findRoundDecidedBy.mockResolvedValue({ id: 'round-1' });

      await expect(service.adminDelete('nom-1', ADMIN)).rejects.toThrow(BadRequestException);
      expect(nominations.softDelete).not.toHaveBeenCalled();
    });

    it('404s on a nomination that does not exist', async () => {
      const { service, nominations } = createHarness(buildNomination());
      nominations.findOne.mockResolvedValue(null);

      await expect(service.adminDelete('missing', ADMIN)).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminRestore', () => {
    it('restores a deleted nomination and clears the deletion record', async () => {
      const { service, nominations } = createHarness(
        buildNomination({ deletedAt: new Date(), deletedByEmail: 'admin@bitwarden.com' }),
      );

      await service.adminRestore('nom-1', ADMIN);

      expect(nominations.restore).toHaveBeenCalledWith('nom-1');
      expect(nominations.update).toHaveBeenCalledWith('nom-1', { deletedByEmail: null });
    });

    it('rejects restoring a nomination that was never deleted', async () => {
      const { service, nominations } = createHarness(buildNomination());

      await expect(service.adminRestore('nom-1', ADMIN)).rejects.toThrow(BadRequestException);
      expect(nominations.restore).not.toHaveBeenCalled();
    });
  });
});
