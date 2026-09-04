import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Requires the caller to hold *all* of these permissions. Admins bypass the check
 * entirely — see PermissionsGuard.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
