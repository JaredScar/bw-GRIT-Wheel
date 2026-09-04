import { Permission } from '../access-control/permission.enum';
import { Role } from './role.enum';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  /** Convenience mirror of `roles.includes(Role.Admin)` for the client. */
  isAdmin: boolean;
  /**
   * Effective permissions for this session. Populated from the account's access role, or
   * the complete set for admins — who bypass access roles entirely — so that a single
   * membership test answers "can they do this?" on both sides of the wire.
   */
  permissions: Permission[];
  /** Name of the assigned access role, surfaced so the UI can explain a denial. */
  accessRoleName: string | null;
}
