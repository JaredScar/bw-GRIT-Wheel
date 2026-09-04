import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Permission } from '../models/permission';
import { SessionUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = '/api/auth';

  readonly currentUser = signal<SessionUser | null>(null);
  readonly isAdmin = computed(() => this.currentUser()?.isAdmin ?? false);

  private readonly permissions = computed(() => new Set(this.currentUser()?.permissions ?? []));

  /**
   * Whether the signed-in account may use a feature. The server enforces the same check on
   * every request — this only decides what to render, so a stale session never grants
   * access, it just shows a link that 403s.
   *
   * Admins are given every permission server-side, so there's no admin special-case here.
   */
  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  /** Resolves once the initial session check (cookie -> /me) has settled, one way or another. */
  readonly ready: Promise<void>;

  constructor(private readonly http: HttpClient) {
    this.ready = this.refreshSession().then(() => undefined);
  }

  async refreshSession(): Promise<SessionUser | null> {
    try {
      const user = await firstValueFrom(this.http.get<SessionUser>(`${this.baseUrl}/me`));
      this.currentUser.set(user);
      return user;
    } catch {
      this.currentUser.set(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.baseUrl}/logout`, {}));
    this.currentUser.set(null);
  }

  async updateDisplayName(name: string): Promise<SessionUser> {
    const user = await firstValueFrom(
      this.http.patch<SessionUser>(`${this.baseUrl}/me`, { name }),
    );
    this.currentUser.set(user);
    return user;
  }
}
