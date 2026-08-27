import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly editingName = signal(false);
  readonly nameDraft = signal('');
  readonly savingName = signal(false);
  readonly nameError = signal<string | null>(null);

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/login');
  }

  openNameEditor(): void {
    const user = this.authService.currentUser();
    this.nameDraft.set(user?.name ?? '');
    this.nameError.set(null);
    this.editingName.set(true);
  }

  cancelNameEdit(): void {
    this.editingName.set(false);
    this.nameError.set(null);
  }

  async saveName(): Promise<void> {
    const name = this.nameDraft().trim();
    if (!name) {
      this.nameError.set('Please enter a name.');
      return;
    }

    this.savingName.set(true);
    this.nameError.set(null);
    try {
      await this.authService.updateDisplayName(name);
      this.editingName.set(false);
    } catch (err) {
      const message =
        err instanceof HttpErrorResponse ? (err.error?.message as string) : undefined;
      this.nameError.set(message ?? 'Unable to update your display name.');
    } finally {
      this.savingName.set(false);
    }
  }
}
