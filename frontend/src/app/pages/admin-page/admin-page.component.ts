import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent {
  readonly authService = inject(AuthService);

  readonly navItems = [
    { path: 'rounds', label: 'Rounds & wheel' },
    { path: 'directory', label: 'Nominee directory' },
    { path: 'users', label: 'Manage users' },
    { path: 'analytics', label: 'Analytics' },
  ];
}
