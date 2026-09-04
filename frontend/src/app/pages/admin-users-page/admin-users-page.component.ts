import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { AccessRole } from '../../models/access-role.model';
import { ManagedUser } from '../../models/user.model';
import { AccessControlService } from '../../services/access-control.service';
import { AuthService } from '../../services/auth.service';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, ConfirmDialogComponent],
  templateUrl: './admin-users-page.component.html',
  styleUrl: './admin-users-page.component.scss',
})
export class AdminUsersPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly usersService = inject(UsersService);
  private readonly accessControlService = inject(AccessControlService);

  readonly newUserForm = this.fb.group({
    email: ['', [Validators.required]],
    name: [''],
  });

  readonly users = signal<ManagedUser[]>([]);
  readonly loadingUsers = signal(false);
  readonly usersError = signal<string | null>(null);
  readonly creatingUser = signal(false);
  readonly createUserError = signal<string | null>(null);
  readonly editingUserId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly savingUserId = signal<string | null>(null);
  readonly renameError = signal<string | null>(null);
  readonly userPendingDelete = signal<ManagedUser | null>(null);
  readonly deletingUser = signal(false);
  readonly deleteUserError = signal<string | null>(null);

  readonly accessRoles = signal<AccessRole[]>([]);
  readonly assigningRoleUserId = signal<string | null>(null);
  readonly assignRoleError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadUsers();
    this.loadAccessRoles();
  }

  loadAccessRoles(): void {
    this.accessControlService.listRoles().subscribe({
      next: (roles) => this.accessRoles.set(roles),
      error: (err: HttpErrorResponse) =>
        this.assignRoleError.set(err.error?.message ?? 'Unable to load access roles.'),
    });
  }

  /**
   * Admins bypass access roles entirely, so their assigned role is shown but has no effect
   * — the dropdown stays editable for when the account is later demoted.
   */
  assignAccessRole(user: ManagedUser, accessRoleId: string): void {
    if (!accessRoleId || accessRoleId === user.accessRoleId) return;

    this.assignRoleError.set(null);
    this.assigningRoleUserId.set(user.id);

    this.usersService.assignAccessRole(user.id, accessRoleId).subscribe({
      next: (updated) => {
        this.assigningRoleUserId.set(null);
        this.users.update((users) => users.map((u) => (u.id === updated.id ? updated : u)));
      },
      error: (err: HttpErrorResponse) => {
        this.assigningRoleUserId.set(null);
        this.assignRoleError.set(err.error?.message ?? 'Unable to change that access role.');
      },
    });
  }

  loadUsers(): void {
    this.loadingUsers.set(true);
    this.usersError.set(null);
    this.usersService.listAll().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loadingUsers.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingUsers.set(false);
        this.usersError.set(err.error?.message ?? 'Unable to load users.');
      },
    });
  }

  createUser(): void {
    this.createUserError.set(null);
    if (this.newUserForm.invalid) {
      this.newUserForm.markAllAsTouched();
      return;
    }
    this.creatingUser.set(true);
    const value = this.newUserForm.getRawValue();
    this.usersService.create(value.email!.trim(), value.name?.trim() || undefined).subscribe({
      next: (user) => {
        this.creatingUser.set(false);
        this.newUserForm.reset();
        this.users.update((users) =>
          [...users, user].sort((a, b) => a.email.localeCompare(b.email)),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.creatingUser.set(false);
        this.createUserError.set(err.error?.message ?? 'Unable to add that user.');
      },
    });
  }

  startEditingUser(user: ManagedUser): void {
    this.renameError.set(null);
    this.editingUserId.set(user.id);
    this.editingName.set(user.name ?? '');
  }

  cancelEditingUser(): void {
    this.editingUserId.set(null);
    this.editingName.set('');
  }

  saveUserName(user: ManagedUser): void {
    const name = this.editingName().trim();
    if (!name || this.savingUserId()) return;

    this.renameError.set(null);
    this.savingUserId.set(user.id);
    this.usersService.rename(user.id, name).subscribe({
      next: (updated) => {
        this.savingUserId.set(null);
        this.editingUserId.set(null);
        this.users.update((users) => users.map((u) => (u.id === updated.id ? updated : u)));
      },
      error: (err: HttpErrorResponse) => {
        this.savingUserId.set(null);
        this.renameError.set(err.error?.message ?? 'Unable to rename that user.');
      },
    });
  }

  confirmDeleteUser(user: ManagedUser): void {
    this.deleteUserError.set(null);
    this.userPendingDelete.set(user);
  }

  cancelDeleteUser(): void {
    this.userPendingDelete.set(null);
    this.deleteUserError.set(null);
  }

  deleteUser(): void {
    const user = this.userPendingDelete();
    if (!user || this.deletingUser()) return;

    this.deleteUserError.set(null);
    this.deletingUser.set(true);
    this.usersService.remove(user.id).subscribe({
      next: () => {
        this.deletingUser.set(false);
        this.users.update((users) => users.filter((u) => u.id !== user.id));
        this.userPendingDelete.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingUser.set(false);
        this.deleteUserError.set(err.error?.message ?? 'Unable to delete that user.');
      },
    });
  }
}
