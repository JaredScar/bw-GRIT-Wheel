import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AccessControlController } from './access-control.controller';
import { AccessControlService } from './access-control.service';
import { AccessRole } from './access-role.entity';
import { PermissionsGuard } from './permissions.guard';

/**
 * Deliberately does not import AuthModule: AuthModule depends on this one (to resolve a
 * session's permissions), and only the @Roles decorator — not the guard itself — is needed
 * to protect this module's admin-only controller.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AccessRole, User])],
  controllers: [AccessControlController],
  providers: [AccessControlService, PermissionsGuard],
  exports: [AccessControlService, PermissionsGuard],
})
export class AccessControlModule {}
