import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-verify-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-verify-page.component.html',
  styleUrl: './auth-verify-page.component.scss',
})
export class AuthVerifyPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly verifying = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.verifying.set(false);
      this.errorMessage.set('This sign-in link is missing its token.');
      return;
    }

    this.authService
      .verify(token)
      .then(() => {
        this.router.navigateByUrl('/nominate');
      })
      .catch((err: HttpErrorResponse) => {
        this.verifying.set(false);
        this.errorMessage.set(
          err.error?.message ?? 'This sign-in link is invalid or has expired.',
        );
      });
  }
}
