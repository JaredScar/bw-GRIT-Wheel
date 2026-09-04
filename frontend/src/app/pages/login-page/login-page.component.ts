import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

const ERROR_MESSAGES: Record<string, string> = {
  domain:
    'That Google account isn\'t a @bitwarden.com address. Sign in with your Bitwarden work account.',
  cancelled: 'Sign-in was cancelled. Give it another go when you\'re ready.',
  state: 'That sign-in attempt expired or looked suspicious. Please try again.',
  google: "We couldn't verify your Google account. Please try again.",
};

@Component({
  selector: 'app-login-page',
  standalone: true,
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly errorMessage = signal<string | null>(null);
  readonly redirecting = signal(false);

  /** Only true against a backend running with DEV_LOGIN_ENABLED=true. */
  readonly devLoginAvailable = signal(false);
  readonly devEmail = signal('');
  readonly devSigningIn = signal(false);
  readonly devError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const error = this.route.snapshot.queryParamMap.get('error');
    if (error) {
      this.errorMessage.set(ERROR_MESSAGES[error] ?? 'Something went wrong signing you in.');
    }

    await this.authService.ready;
    if (this.authService.currentUser()) {
      this.router.navigateByUrl('/nominate');
      return;
    }

    this.devLoginAvailable.set(await this.authService.devLoginEnabled());
  }

  async devSignIn(): Promise<void> {
    const email = this.devEmail().trim();
    if (!email || this.devSigningIn()) return;

    this.devError.set(null);
    this.devSigningIn.set(true);

    try {
      await this.authService.devLogin(email);
      // Straight to the router: requirePermission() sends them onward if this account
      // can't nominate, exactly as it would after a real sign-in.
      await this.router.navigateByUrl('/nominate');
    } catch (err) {
      const message = (err as HttpErrorResponse).error?.message;
      this.devError.set(
        (Array.isArray(message) ? message[0] : message) ?? 'Dev sign-in failed.',
      );
    } finally {
      this.devSigningIn.set(false);
    }
  }

  signInWithGoogle(): void {
    this.redirecting.set(true);
    // Full-page navigation, not an XHR: the backend needs to 302 us to Google.
    window.location.href = '/api/auth/google';
  }
}
