import { SetMetadata } from '@nestjs/common';
import { Role } from './role.enum';

export const ROLES_KEY = 'roles';

/** Restricts a route (or a whole controller) to users holding at least one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
