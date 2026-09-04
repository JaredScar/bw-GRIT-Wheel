import { Controller, Get, Param } from '@nestjs/common';
import { Permission } from '../access-control/permission.enum';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { PeopleService } from './people.service';

/**
 * Every route here reports per-person nomination history or aggregates of it, so the whole
 * controller sits behind the same permission as the profile pages it backs.
 */
@RequirePermissions(Permission.PersonView)
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  listPeople() {
    return this.peopleService.listPeople();
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.peopleService.getLeaderboard();
  }

  // NOTE: this catch-all param route must stay last so it doesn't shadow
  // the more specific routes above (e.g. `leaderboard`).
  @Get(':email')
  getProfile(@Param('email') email: string) {
    return this.peopleService.getProfile(email);
  }
}
