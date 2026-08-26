import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AvatarService {
  private readonly baseUrl = '/api/avatars';

  /**
   * Always returns a URL for a non-empty email, even when nobody by that address has
   * ever signed in. The endpoint 404s in that case and `AvatarComponent` swaps in its
   * initials placeholder, which is the common path for nominees who have not logged in.
   */
  avatarUrl(email: string | null | undefined): string | null {
    if (!email) return null;
    return `${this.baseUrl}/${encodeURIComponent(email.trim().toLowerCase())}`;
  }
}
