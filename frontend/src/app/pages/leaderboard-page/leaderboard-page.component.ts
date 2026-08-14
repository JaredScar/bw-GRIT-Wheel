import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { GRIT_CATEGORY_LABELS } from '../../models/grit-category';
import { Leaderboard } from '../../models/person.model';
import { PeopleService } from '../../services/people.service';

@Component({
  selector: 'app-leaderboard-page',
  standalone: true,
  imports: [RouterLink, AvatarComponent],
  templateUrl: './leaderboard-page.component.html',
  styleUrl: './leaderboard-page.component.scss',
})
export class LeaderboardPageComponent implements OnInit {
  readonly categoryLabels = GRIT_CATEGORY_LABELS;
  readonly leaderboard = signal<Leaderboard | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(private readonly peopleService: PeopleService) {}

  ngOnInit(): void {
    this.peopleService.getLeaderboard().subscribe({
      next: (leaderboard) => {
        this.leaderboard.set(leaderboard);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load the leaderboard right now.');
        this.loading.set(false);
      },
    });
  }

  badgeClass(category: string): string {
    return `badge-${category.toLowerCase()}`;
  }
}
