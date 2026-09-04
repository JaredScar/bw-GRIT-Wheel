import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { NominationEditDialogComponent } from '../../components/nomination-edit-dialog/nomination-edit-dialog.component';
import {
  GRIT_CATEGORIES,
  GRIT_CATEGORY_LABELS,
  GritCategory,
} from '../../models/grit-category';
import { Nomination, UpdateNominationPayload } from '../../models/nomination.model';
import { REACTION_EMOJI, REACTION_LABELS, REACTION_TYPES, ReactionType } from '../../models/reaction-type';
import { AuthService } from '../../services/auth.service';
import { NominationService } from '../../services/nomination.service';

@Component({
  selector: 'app-feed-page',
  standalone: true,
  imports: [
    DatePipe,
    AvatarComponent,
    RouterLink,
    ConfirmDialogComponent,
    NominationEditDialogComponent,
  ],
  templateUrl: './feed-page.component.html',
  styleUrl: './feed-page.component.scss',
})
export class FeedPageComponent implements OnInit {
  readonly authService = inject(AuthService);

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

  // Admin moderation state. `showDeleted` asks the server for soft-deleted nominations too,
  // so it re-fetches rather than filtering what's already loaded.
  readonly showDeleted = signal(false);
  readonly editing = signal<Nomination | null>(null);
  readonly savingEdit = signal(false);
  readonly editError = signal<string | null>(null);
  readonly deleting = signal<Nomination | null>(null);
  readonly confirmingDelete = signal(false);
  readonly deleteError = signal<string | null>(null);

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
    this.nominationService.findAll({ roundId, includeDeleted: this.showDeleted() }).subscribe({
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

  isDeleted(nomination: Nomination): boolean {
    return !!nomination.deletedAt;
  }

  toggleShowDeleted(): void {
    this.showDeleted.update((value) => !value);
    this.load();
  }

  startEdit(nomination: Nomination): void {
    this.editError.set(null);
    this.editing.set(nomination);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.editError.set(null);
    this.savingEdit.set(false);
  }

  saveEdit(payload: UpdateNominationPayload): void {
    const target = this.editing();
    if (!target) return;

    this.savingEdit.set(true);
    this.editError.set(null);
    this.nominationService.update(target.id, payload).subscribe({
      next: (updated) => {
        this.replaceNomination(updated);
        this.savingEdit.set(false);
        this.editing.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.savingEdit.set(false);
        this.editError.set(this.messageFrom(err, 'Unable to save this nomination.'));
      },
    });
  }

  startDelete(nomination: Nomination): void {
    this.deleteError.set(null);
    this.deleting.set(nomination);
  }

  cancelDelete(): void {
    this.deleting.set(null);
    this.deleteError.set(null);
    this.confirmingDelete.set(false);
  }

  confirmDelete(): void {
    const target = this.deleting();
    if (!target) return;

    this.confirmingDelete.set(true);
    this.deleteError.set(null);
    this.nominationService.remove(target.id).subscribe({
      next: () => {
        this.confirmingDelete.set(false);
        this.deleting.set(null);
        // Deleted nominations vanish from the default view but stay visible (marked as
        // deleted) while "show deleted" is on, so reload rather than splicing locally.
        this.load();
      },
      error: (err: HttpErrorResponse) => {
        this.confirmingDelete.set(false);
        this.deleteError.set(this.messageFrom(err, 'Unable to delete this nomination.'));
      },
    });
  }

  restore(nomination: Nomination): void {
    this.errorMessage.set(null);
    this.nominationService.restore(nomination.id).subscribe({
      next: (restored) => this.replaceNomination(restored),
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.messageFrom(err, 'Unable to restore this nomination.'));
      },
    });
  }

  private replaceNomination(updated: Nomination): void {
    this.nominations.update((list) => list.map((n) => (n.id === updated.id ? updated : n)));
  }

  private messageFrom(err: HttpErrorResponse, fallback: string): string {
    const message = Array.isArray(err.error?.message)
      ? err.error.message.join(', ')
      : err.error?.message;
    return message ?? fallback;
  }
}
