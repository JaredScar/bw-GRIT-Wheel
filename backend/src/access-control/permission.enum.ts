/**
 * Fine-grained capabilities that can be granted to an access role. Admins bypass these
 * entirely (see PermissionsGuard), so this list only ever describes what a *non-admin*
 * account is allowed to do.
 *
 * Values are persisted in `access_roles.permissions`, so renaming one is a data migration.
 */
export enum Permission {
  /** Submit a new nomination. */
  NominationCreate = 'nomination:create',
  /** Read the nominations feed (and any single nomination). */
  NominationView = 'nomination:view',
  /** Add/remove reactions on a nomination. */
  NominationReact = 'nomination:react',
  /** Read the GRIT Hall of Names (past rounds and their winners). */
  HallView = 'hall:view',
  /** Read an individual person's profile page. */
  PersonView = 'person:view',
}

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(Permission);

const PERMISSION_VALUES = new Set<string>(ALL_PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_VALUES.has(value);
}

/**
 * Drops anything that isn't a currently-known permission. Guards against a role row that
 * still carries a permission removed in a later release.
 */
export function sanitizePermissions(
  values: readonly string[] | null | undefined,
): Permission[] {
  if (!values?.length) return [];
  return [...new Set(values.filter(isPermission))];
}

/** UI-facing metadata for the admin access-control screen. */
export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  /**
   * Permissions this one is useless without — the admin UI surfaces this as a hint. Not
   * enforced server-side: each endpoint checks only the permission it actually needs.
   */
  requires?: Permission[];
}

export const PERMISSION_CATALOG: readonly PermissionDefinition[] = [
  {
    key: Permission.NominationCreate,
    label: 'Submit nominations',
    description: 'Nominate a colleague for a GRIT award.',
  },
  {
    key: Permission.NominationView,
    label: 'View the nominations feed',
    description: 'Browse nominations others have submitted.',
  },
  {
    key: Permission.NominationReact,
    label: 'React to nominations',
    description: 'Add reactions to nominations in the feed.',
    requires: [Permission.NominationView],
  },
  {
    key: Permission.HallView,
    label: 'View the GRIT Hall of Names',
    description: 'See past rounds and the winner announced for each.',
  },
  {
    key: Permission.PersonView,
    label: 'View person profiles',
    description: "Open an individual's profile and their nomination history.",
  },
];
