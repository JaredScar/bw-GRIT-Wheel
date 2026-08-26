import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  GRIT_CATEGORIES,
  GRIT_CATEGORY_DESCRIPTIONS,
  GRIT_CATEGORY_LABELS,
  GritCategory,
} from '../../models/grit-category';
import { PersonSummary } from '../../models/person.model';
import { AuthService } from '../../services/auth.service';
import { NominationService } from '../../services/nomination.service';
import { PeopleService } from '../../services/people.service';

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
  private readonly peopleService = inject(PeopleService);
  readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly knownPeople = signal<PersonSummary[]>([]);

  readonly form = this.fb.group({
    nominatorName: ['', [Validators.required, Validators.maxLength(120)]],
    isAnonymous: [false],
    nomineeName: ['', [Validators.required, Validators.maxLength(120)]],
    gritCategories: this.fb.control<GritCategory[]>([], [minSelectionValidator(1)]),
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    this.peopleService.listPeople().subscribe({
      next: (people) => this.knownPeople.set(people),
      error: () => {
        // Autocomplete is a nice-to-have; fail silently if it can't load.
      },
    });
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
        nominatorName: value.nominatorName!.trim(),
        isAnonymous: !!value.isAnonymous,
        nomineeName: value.nomineeName!.trim(),
        gritCategories: value.gritCategories!,
        reason: value.reason!.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.form.reset({ isAnonymous: false, gritCategories: [] });
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
