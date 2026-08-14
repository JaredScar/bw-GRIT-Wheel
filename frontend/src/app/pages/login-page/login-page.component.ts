import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

function bitwardenEmailValidator(): ValidatorFn {
  const pattern = /^[a-zA-Z0-9._%+-]+@bitwarden\.com$/i;
  return (control): ValidationErrors | null => {
    if (!control.value) return null;
    return pattern.test(control.value.trim()) ? null : { bitwardenEmail: true };
  };
}

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    email: ['', [Validators.required, bitwardenEmailValidator()]],
  });

  readonly submitting = signal(false);
  readonly linkSent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.authService.ready;
    if (this.authService.currentUser()) {
      this.router.navigateByUrl('/nominate');
    }
  }

  submit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const email = this.form.value.email!.trim();

    this.authService.requestMagicLink(email).subscribe({
      next: () => {
        this.submitting.set(false);
        this.linkSent.set(true);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        const message = Array.isArray(err.error?.message)
          ? err.error.message.join(', ')
          : err.error?.message;
        this.errorMessage.set(message ?? 'Something went wrong sending your sign-in link.');
      },
    });
  }

  sendAnother(): void {
    this.linkSent.set(false);
  }
}
