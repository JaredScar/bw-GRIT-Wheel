import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AccessRole } from '../../models/access-role.model';
import { Permission, PermissionDefinition } from '../../models/permission';
import { AccessControlService } from '../../services/access-control.service';

@Component({
  selector: 'app-admin-access-page',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './admin-access-page.component.html',
  styleUrl: './admin-access-page.component.scss',
})
export class AdminAccessPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly accessControlService = inject(AccessControlService);

  readonly catalog = signal<PermissionDefinition[]>([]);
  readonly roles = signal<AccessRole[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  /**
   * Unsaved permission edits, keyed by role id. A role with no entry here is showing
   * exactly what the server has, which is how the Save button knows when to enable.
   */
  private readonly drafts = signal<Record<string, Permission[]>>({});

  readonly savingRoleId = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  readonly newRoleForm = this.fb.group({
    name: ['', [Validators.required]],
    description: [''],
  });
  readonly newRolePermissions = signal<Permission[]>([]);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);

  readonly rolePendingDelete = signal<AccessRole | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly defaultRoleName = computed(
    () => this.roles().find((role) => role.isDefault)?.name ?? null,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.accessControlService.listPermissions().subscribe({
      next: (catalog) => this.catalog.set(catalog),
      error: (err: HttpErrorResponse) =>
        this.loadError.set(err.error?.message ?? 'Unable to load the permission list.'),
    });

    this.accessControlService.listRoles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        this.drafts.set({});
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(err.error?.message ?? 'Unable to load access roles.');
      },
    });
  }

  // --- per-role permission editing -------------------------------------------------

  permissionsOf(role: AccessRole): Permission[] {
    return this.drafts()[role.id] ?? role.permissions;
  }

  isGranted(role: AccessRole, permission: Permission): boolean {
    return this.permissionsOf(role).includes(permission);
  }

  togglePermission(role: AccessRole, permission: Permission): void {
    const current = this.permissionsOf(role);
    const next = current.includes(permission)
      ? current.filter((p) => p !== permission)
      : [...current, permission];

    this.drafts.update((drafts) => ({ ...drafts, [role.id]: next }));
  }

  hasUnsavedChanges(role: AccessRole): boolean {
    const draft = this.drafts()[role.id];
    if (!draft) return false;
    return !sameMembers(draft, role.permissions);
  }

  /**
   * Permissions granted to this role whose prerequisites aren't. Not an error — the server
   * accepts it — but reacting without feed access, say, does nothing, so it's worth saying.
   */
  unmetPrerequisites(role: AccessRole): string[] {
    const granted = new Set(this.permissionsOf(role));

    return this.catalog()
      .filter((entry) => granted.has(entry.key))
      .flatMap((entry) =>
        (entry.requires ?? [])
          .filter((prerequisite) => !granted.has(prerequisite))
          .map((prerequisite) => `"${entry.label}" also needs "${this.labelOf(prerequisite)}"`),
      );
  }

  labelOf(permission: Permission): string {
    return this.catalog().find((entry) => entry.key === permission)?.label ?? permission;
  }

  discardChanges(role: AccessRole): void {
    this.drafts.update(({ [role.id]: _discarded, ...rest }) => rest);
    this.saveError.set(null);
  }

  saveRole(role: AccessRole): void {
    if (!this.hasUnsavedChanges(role) || this.savingRoleId()) return;

    this.saveError.set(null);
    this.savingRoleId.set(role.id);

    this.accessControlService
      .updateRole(role.id, { permissions: this.permissionsOf(role) })
      .subscribe({
        next: (updated) => {
          this.savingRoleId.set(null);
          this.replaceRole(updated);
          this.discardChanges(updated);
        },
        error: (err: HttpErrorResponse) => {
          this.savingRoleId.set(null);
          this.saveError.set(err.error?.message ?? 'Unable to save that role.');
        },
      });
  }

  makeDefault(role: AccessRole): void {
    if (role.isDefault || this.savingRoleId()) return;

    this.saveError.set(null);
    this.savingRoleId.set(role.id);

    this.accessControlService.updateRole(role.id, { isDefault: true }).subscribe({
      next: () => {
        this.savingRoleId.set(null);
        // Reload: promoting one role demotes another, so more than one row changed.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.savingRoleId.set(null);
        this.saveError.set(err.error?.message ?? 'Unable to change the default role.');
      },
    });
  }

  // --- creating a role -------------------------------------------------------------

  isNewRolePermissionGranted(permission: Permission): boolean {
    return this.newRolePermissions().includes(permission);
  }

  toggleNewRolePermission(permission: Permission): void {
    this.newRolePermissions.update((current) =>
      current.includes(permission)
        ? current.filter((p) => p !== permission)
        : [...current, permission],
    );
  }

  createRole(): void {
    this.createError.set(null);
    if (this.newRoleForm.invalid) {
      this.newRoleForm.markAllAsTouched();
      return;
    }

    this.creating.set(true);
    const value = this.newRoleForm.getRawValue();

    this.accessControlService
      .createRole({
        name: value.name!.trim(),
        description: value.description?.trim() || undefined,
        permissions: this.newRolePermissions(),
      })
      .subscribe({
        next: (role) => {
          this.creating.set(false);
          this.newRoleForm.reset();
          this.newRolePermissions.set([]);
          this.roles.update((roles) => [...roles, role]);
        },
        error: (err: HttpErrorResponse) => {
          this.creating.set(false);
          this.createError.set(err.error?.message ?? 'Unable to create that role.');
        },
      });
  }

  // --- deleting a role -------------------------------------------------------------

  confirmDelete(role: AccessRole): void {
    this.deleteError.set(null);
    this.rolePendingDelete.set(role);
  }

  cancelDelete(): void {
    this.rolePendingDelete.set(null);
    this.deleteError.set(null);
  }

  deleteRole(): void {
    const role = this.rolePendingDelete();
    if (!role || this.deleting()) return;

    this.deleteError.set(null);
    this.deleting.set(true);

    this.accessControlService.deleteRole(role.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.rolePendingDelete.set(null);
        // Reload: its members were moved onto the default role, changing that count too.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.deleting.set(false);
        this.deleteError.set(err.error?.message ?? 'Unable to delete that role.');
      },
    });
  }

  deleteMessageFor(role: AccessRole): string {
    const destination = this.defaultRoleName() ?? 'the default role';
    const members =
      role.memberCount === 1 ? '1 account is' : `${role.memberCount} accounts are`;

    return role.memberCount > 0
      ? `${members} on "${role.name}" and will be moved to "${destination}". This cannot be undone.`
      : `"${role.name}" has no members. This cannot be undone.`;
  }

  private replaceRole(updated: AccessRole): void {
    this.roles.update((roles) => roles.map((role) => (role.id === updated.id ? updated : role)));
  }
}

/** Order-insensitive comparison — the draft appends, so it drifts out of server order. */
function sameMembers(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}
