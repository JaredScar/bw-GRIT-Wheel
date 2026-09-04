import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { AccessControlService } from './access-control.service';
import { CreateAccessRoleDto } from './dto/create-access-role.dto';
import { UpdateAccessRoleDto } from './dto/update-access-role.dto';
import { PERMISSION_CATALOG } from './permission.enum';

@Roles(Role.Admin)
@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  /** The set of permissions this build knows about, with labels for the admin UI. */
  @Get('permissions')
  listPermissions() {
    return PERMISSION_CATALOG;
  }

  @Get('roles')
  listRoles() {
    return this.accessControlService.listRoles();
  }

  @Post('roles')
  createRole(@Body() dto: CreateAccessRoleDto) {
    return this.accessControlService.createRole(dto);
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessRoleDto,
  ) {
    return this.accessControlService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  async deleteRole(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.accessControlService.deleteRole(id);
  }
}
