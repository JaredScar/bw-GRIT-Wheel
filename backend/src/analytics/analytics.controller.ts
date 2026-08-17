import { Controller, Get } from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Roles(Role.Admin)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary() {
    return this.analyticsService.getSummary();
  }
}
