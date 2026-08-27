export type Role = 'user' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  isAdmin: boolean;
}

/** Full account record as returned by the admin-only /users endpoints. */
export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  roles: Role[];
  lastLoginAt: string | null;
  createdAt: string;
}
