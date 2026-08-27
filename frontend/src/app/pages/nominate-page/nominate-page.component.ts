import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DirectoryPerson } from '../../models/directory-person.model';
import {
  GRIT_CATEGORIES,
  GRIT_CATEGORY_DESCRIPTIONS,
  GRIT_CATEGORY_LABELS,
  GritCategory,
} from '../../models/grit-category';
import { AuthService } from '../../services/auth.service';
import { DirectoryService } from '../../services/directory.service';
import { NominationService } from '../../services/nomination.service';

const MAX_SUGGESTIONS = 8;

function minSelectionValidator(min: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = (control.value as unknown[] | null) ?? [];
    return value.length >= min ? null : { minSelection: true };
  };
}

@Component({
  selector: 'app-nominate-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './nominate-page.component.html',
  styleUrl: './nominate-page.component.scss',
})
export class NominatePageComponent implements OnInit {
  readonly gritCategories = GRIT_CATEGORIES;
  readonly categoryLabels = GRIT_CATEGORY_LABELS;
  readonly categoryDescriptions = GRIT_CATEGORY_DESCRIPTIONS;

  private readonly fb = inject(FormBuilder);
  private readonly nominationService = inject(NominationService);
  private readonly directoryService = inject(DirectoryService);
  readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly directoryLoadError = signal<string | null>(null);

  readonly directory = signal<DirectoryPerson[]>([]);
  readonly nomineeQuery = signal('');
  readonly showSuggestions = signal(false);

  readonly nomineeMatches = computed(() => {
    const term = this.nomineeQuery().trim().toLowerCase();
    const people = this.directory();
    if (!term) return people.slice(0, MAX_SUGGESTIONS);
    return people.filter((p) => p.name.toLowerCase().includes(term)).slice(0, MAX_SUGGESTIONS);
  });

  readonly form = this.fb.group({
    isAnonymous: [false],
    nomineeEmail: ['', [Validators.required]],
    gritCategories: this.fb.control<GritCategory[]>([], [minSelectionValidator(1)]),
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  get nominatorDisplayName(): string {
    const user = this.authService.currentUser();
    return user?.name || user?.email || '';
  }

  ngOnInit(): void {
    this.directoryService.listAll().subscribe({
      next: (people) => this.directory.set(people),
      error: () => {
        this.directoryLoadError.set(
          'Unable to load the nominee directory. Please refresh the page and try again.',
        );
      },
    });
  }

  onNomineeInput(value: string): void {
    this.nomineeQuery.set(value);
    this.showSuggestions.set(true);
    const control = this.form.get('nomineeEmail')!;
    if (control.value) {
      control.setValue('');
    }
  }

  onNomineeFocus(): void {
    this.showSuggestions.set(true);
  }

  onNomineeBlur(): void {
    this.showSuggestions.set(false);
    this.form.get('nomineeEmail')!.markAsTouched();
  }

  selectNominee(person: DirectoryPerson, event: Event): void {
    event.preventDefault();
    this.nomineeQuery.set(person.name);
    this.form.get('nomineeEmail')!.setValue(person.email);
    this.form.get('nomineeEmail')!.markAsTouched();
    this.showSuggestions.set(false);
  }

  isCategorySelected(category: GritCategory): boolean {
    return (this.form.get('gritCategories')?.value ?? []).includes(category);
  }

  toggleCategory(category: GritCategory, checked: boolean): void {
    const control = this.form.get('gritCategories')!;
    const current = (control.value as GritCategory[]) ?? [];
    const next = checked ? [...current, category] : current.filter((c) => c !== category);
    control.setValue(next);
    control.markAsTouched();
  }

  submit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);

    this.nominationService
      .create({
        isAnonymous: !!value.isAnonymous,
        nomineeEmail: value.nomineeEmail!,
        gritCategories: value.gritCategories!,
        reason: value.reason!.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.nomineeQuery.set('');
          this.form.reset({ isAnonymous: false, nomineeEmail: '', gritCategories: [] });
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          const message = Array.isArray(err.error?.message)
            ? err.error.message.join(', ')
            : err.error?.message;
          this.errorMessage.set(message ?? 'Something went wrong submitting your nomination.');
        },
      });
  }

  submitAnother(): void {
    this.submitted.set(false);
  }
}
