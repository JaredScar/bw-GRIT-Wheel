import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Permission } from '../access-control/permission.enum';
import { RequirePermissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import type { SessionUser } from '../auth/session-user';
import { GritCategory } from '../common/grit-category.enum';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { UpdateNominationDto } from './dto/update-nomination.dto';
import { NominationsService } from './nominations.service';

@Controller('nominations')
export class NominationsController {
  constructor(private readonly nominationsService: NominationsService) {}

  @RequirePermissions(Permission.NominationCreate)
  @Post()
  create(@Body() dto: CreateNominationDto, @CurrentUser() user: SessionUser) {
    return this.nominationsService.create(dto, user);
  }

  @RequirePermissions(Permission.NominationView)
  @Get()
  findAll(
    @CurrentUser() user: SessionUser,
    @Query('roundId') roundId?: string,
    @Query('gritCategory') gritCategory?: GritCategory,
    @Query('nomineeEmail') nomineeEmail?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.nominationsService.findAll({
      roundId,
      gritCategory,
      nomineeEmail,
      viewerEmail: user.email,
      // Deleted nominations are an admin-only view; the flag is ignored for everyone else
      // rather than rejected, so a stale tab can't 403 the whole feed.
      includeDeleted: user.isAdmin && includeDeleted === 'true',
    });
  }

  @RequirePermissions(Permission.NominationView)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.nominationsService.findOnePublic(id, user.email);
  }

  @RequirePermissions(Permission.NominationReact)
  @Post(':id/reactions')
  toggleReaction(
    @Param('id') id: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.nominationsService.toggleReaction(id, user.email, dto.type);
  }

  // Moderation is admin-only and deliberately not an access-role permission: correcting or
  // removing someone else's public recognition is a different kind of authority from
  // viewing the feed, and it shouldn't be grantable by ticking a box.
  @Roles(Role.Admin)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNominationDto,
    @CurrentUser() user: SessionUser,
  ) {
    return this.nominationsService.adminUpdate(id, dto, user);
  }

  @Roles(Role.Admin)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: SessionUser): Promise<void> {
    await this.nominationsService.adminDelete(id, user);
  }

  @Roles(Role.Admin)
  @Post(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.nominationsService.adminRestore(id, user);
  }
}
