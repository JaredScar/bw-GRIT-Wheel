import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { SessionUser } from '../auth/session-user';
import { GritCategory } from '../common/grit-category.enum';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { NominationsService } from './nominations.service';

@Controller('nominations')
export class NominationsController {
  constructor(private readonly nominationsService: NominationsService) {}

  @Post()
  create(@Body() dto: CreateNominationDto, @CurrentUser() user: SessionUser) {
    return this.nominationsService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: SessionUser,
    @Query('roundId') roundId?: string,
    @Query('gritCategory') gritCategory?: GritCategory,
    @Query('nomineeEmail') nomineeEmail?: string,
  ) {
    return this.nominationsService.findAll({
      roundId,
      gritCategory,
      nomineeEmail,
      viewerEmail: user.email,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.nominationsService.findOnePublic(id, user.email);
  }

  @Post(':id/reactions')
  toggleReaction(
    @Param('id') id: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.nominationsService.toggleReaction(id, user.email, dto.type);
  }
}
