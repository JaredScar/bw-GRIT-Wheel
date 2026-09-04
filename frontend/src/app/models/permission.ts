/**
 * Mirrors `Permission` in backend/src/access-control/permission.enum.ts. Kept as a union of
 * string literals so route guards and templates can name a permission without a runtime
 * import, while the human-readable labels come from the API (see PermissionDefinition).
 */
export type Permission =
  | 'nomination:create'
  | 'nomination:view'
  | 'nomination:react'
  | 'hall:view'
  | 'person:view';

/** Catalog entry served by GET /api/access-control/permissions. */
export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  /** Permissions this one is useless without — surfaced as a hint in the admin UI. */
  requires?: Permission[];
}
