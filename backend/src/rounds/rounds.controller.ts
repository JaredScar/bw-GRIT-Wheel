import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { CreateRoundDto } from './dto/create-round.dto';
import { SpinWheelDto } from './dto/spin-wheel.dto';
import { RoundsService } from './rounds.service';

@Controller('rounds')
export class RoundsController {
  constructor(private readonly roundsService: RoundsService) {}

  @Get()
  findAll() {
    return this.roundsService.findAll();
  }

  // Admin-only because it opens a round as a side effect. Nominating still opens the
  // first round automatically via NominationsService.create().
  @Roles(Role.Admin)
  @Get('current')
  async getCurrent() {
    return this.roundsService.getOrCreateCurrentOpenRound();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roundsService.findOne(id);
  }

  @Roles(Role.Admin)
  @Get(':id/wheel')
  getWheelEntries(@Param('id') id: string) {
    return this.roundsService.getWheelEntries(id);
  }

  @Roles(Role.Admin)
  @Post()
  create(@Body() dto: CreateRoundDto) {
    return this.roundsService.createRound(dto);
  }

  @Roles(Role.Admin)
  @Post(':id/spin')
  spin(@Param('id') id: string, @Body() dto: SpinWheelDto) {
    return this.roundsService.spinWheel(id, dto?.weighted ?? false);
  }
}
