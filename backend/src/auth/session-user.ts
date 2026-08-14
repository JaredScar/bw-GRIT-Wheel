import { Role } from './role.enum';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  /** Convenience mirror of `roles.includes(Role.Admin)` for the client. */
  isAdmin: boolean;
}
