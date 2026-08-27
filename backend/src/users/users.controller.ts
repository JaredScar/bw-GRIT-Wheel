import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import type { SessionUser } from '../auth/session-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Roles(Role.Admin)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listAll() {
    return this.usersService.listAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  rename(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.rename(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() currentUser: SessionUser): Promise<void> {
    await this.usersService.remove(id, currentUser.id);
  }
}
