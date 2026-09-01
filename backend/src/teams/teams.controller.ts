import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { CreateTeamDto } from './dto/create-team.dto';
import { SetTeamMembersDto } from './dto/set-team-members.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamsService } from './teams.service';

@Roles(Role.Admin)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  listAll() {
    return this.teamsService.listAll();
  }

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teamsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.teamsService.remove(id);
  }

  @Put(':id/members')
  setMembers(@Param('id') id: string, @Body() dto: SetTeamMembersDto) {
    return this.teamsService.setMembers(id, dto.emails);
  }
}
