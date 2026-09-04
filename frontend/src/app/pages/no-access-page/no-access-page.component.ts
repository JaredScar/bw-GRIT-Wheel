import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/**
 * Shown when an account's access role grants nothing it could navigate to. Without this
 * there'd be nowhere to redirect a fully-restricted user, and the router would loop.
 */
@Component({
  selector: 'app-no-access-page',
  standalone: true,
  templateUrl: './no-access-page.component.html',
  styleUrl: './no-access-page.component.scss',
})
export class NoAccessPageComponent {
  readonly authService = inject(AuthService);
}
