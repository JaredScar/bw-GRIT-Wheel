import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
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

  @Get('current')
  async getCurrent() {
    return this.roundsService.getOrCreateCurrentOpenRound();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roundsService.findOne(id);
  }

  @Get(':id/wheel')
  getWheelEntries(@Param('id') id: string) {
    return this.roundsService.getWheelEntries(id);
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateRoundDto) {
    return this.roundsService.createRound(dto);
  }

  @UseGuards(AdminGuard)
  @Post(':id/spin')
  spin(@Param('id') id: string, @Body() dto: SpinWheelDto) {
    return this.roundsService.spinWheel(id, dto?.weighted ?? false);
  }
}
