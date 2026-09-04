import { Permission } from './permission';

export type Role = 'user' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  isAdmin: boolean;
  /**
   * Effective permissions for this session. Admins are handed the complete set by the
   * server, so `permissions.includes(...)` alone answers "can they do this?".
   */
  permissions: Permission[];
  accessRoleName: string | null;
}

/** Full account record as returned by the admin-only /users endpoints. */
export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  accessRoleId: string | null;
  accessRoleName: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}
