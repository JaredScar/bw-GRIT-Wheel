import { Controller, Get, Param } from '@nestjs/common';
import { PeopleService } from './people.service';

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
  @Get(':name')
  getProfile(@Param('name') name: string) {
    return this.peopleService.getProfile(name);
  }
}
