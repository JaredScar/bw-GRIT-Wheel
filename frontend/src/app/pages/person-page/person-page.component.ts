import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { GRIT_CATEGORY_LABELS } from '../../models/grit-category';
import { PersonProfile } from '../../models/person.model';
import { PeopleService } from '../../services/people.service';

@Component({
  selector: 'app-person-page',
  standalone: true,
  imports: [DatePipe, RouterLink, AvatarComponent],
  templateUrl: './person-page.component.html',
  styleUrl: './person-page.component.scss',
})
export class PersonPageComponent implements OnInit {
  readonly categoryLabels = GRIT_CATEGORY_LABELS;
  readonly profile = signal<PersonProfile | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly peopleService: PeopleService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const name = params.get('name');
      if (!name) return;
      this.load(name);
    });
  }

  private load(name: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.peopleService.getProfile(name).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load this person right now.');
        this.loading.set(false);
      },
    });
  }

  badgeClass(category: string): string {
    return `badge-${category.toLowerCase()}`;
  }

  displayName(nominatorName: string | null): string {
    return nominatorName ?? 'Anonymous';
  }
}
