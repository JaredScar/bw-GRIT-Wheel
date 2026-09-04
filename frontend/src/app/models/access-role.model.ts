import { Permission } from './permission';

export interface AccessRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  /** The role new accounts land on. Exactly one role has this set. */
  isDefault: boolean;
  /** Seeded roles: permissions are editable, but they can't be renamed or deleted. */
  isSystem: boolean;
  memberCount: number;
}

export interface CreateAccessRolePayload {
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface UpdateAccessRolePayload {
  name?: string;
  description?: string;
  permissions?: Permission[];
  isDefault?: boolean;
}
