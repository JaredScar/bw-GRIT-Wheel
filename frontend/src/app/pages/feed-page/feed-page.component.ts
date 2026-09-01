import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import {
  GRIT_CATEGORIES,
  GRIT_CATEGORY_LABELS,
  GritCategory,
} from '../../models/grit-category';
import { Nomination } from '../../models/nomination.model';
import { REACTION_EMOJI, REACTION_LABELS, REACTION_TYPES, ReactionType } from '../../models/reaction-type';
import { NominationService } from '../../services/nomination.service';

@Component({
  selector: 'app-feed-page',
  standalone: true,
  imports: [DatePipe, AvatarComponent, RouterLink],
  templateUrl: './feed-page.component.html',
  styleUrl: './feed-page.component.scss',
})
export class FeedPageComponent implements OnInit {
  readonly gritCategories = GRIT_CATEGORIES;
  readonly categoryLabels = GRIT_CATEGORY_LABELS;
  readonly reactionTypes = REACTION_TYPES;
  readonly reactionEmoji = REACTION_EMOJI;
  readonly reactionLabels = REACTION_LABELS;

  readonly nominations = signal<Nomination[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedCategory = signal<GritCategory | 'ALL'>('ALL');
  readonly roundId = signal<string | null>(null);
  readonly searchTerm = signal('');

  readonly filteredNominations = computed(() => {
    const category = this.selectedCategory();
    const term = this.searchTerm().trim().toLowerCase();
    let result = this.nominations();

    if (category !== 'ALL') {
      result = result.filter((n) => n.gritCategories.includes(category));
    }

    if (term) {
      result = result.filter((n) => {
        const haystack = [
          n.nomineeName,
          n.reason,
          n.isAnonymous ? '' : n.nominatorName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    return result;
  });

  constructor(
    private readonly nominationService: NominationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.roundId.set(params.get('roundId'));
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    const roundId = this.roundId() ?? undefined;
    this.nominationService.findAll({ roundId }).subscribe({
      next: (nominations) => {
        this.nominations.set(nominations);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load nominations right now.');
        this.loading.set(false);
      },
    });
  }

  clearRoundFilter(): void {
    this.router.navigate([], { queryParams: {} });
  }

  selectCategory(category: GritCategory | 'ALL'): void {
    this.selectedCategory.set(category);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  badgeClass(category: GritCategory): string {
    return `badge-${category.toLowerCase()}`;
  }

  displayName(nomination: Nomination): string {
    return nomination.isAnonymous || !nomination.nominatorName ? 'Anonymous' : nomination.nominatorName;
  }

  hasReacted(nomination: Nomination, type: ReactionType): boolean {
    return nomination.myReactions.includes(type);
  }

  reactionCount(nomination: Nomination, type: ReactionType): number {
    return nomination.reactionCounts[type] ?? 0;
  }

  onReactionClick(nomination: Nomination, type: ReactionType): void {
    this.nominationService.toggleReaction(nomination.id, type).subscribe({
      next: (result) => {
        this.nominations.update((list) =>
          list.map((n) =>
            n.id === nomination.id
              ? {
                  ...n,
                  reactionCounts: result.reactionCounts,
                  myReactions: result.myReactions,
                  upvoteCount: result.reactionCounts[ReactionType.THUMBS_UP] ?? 0,
                  hasUpvoted: result.myReactions.includes(ReactionType.THUMBS_UP),
                }
              : n,
          ),
        );
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(err.error?.message ?? 'Unable to update your reaction.');
      },
    });
  }
}
