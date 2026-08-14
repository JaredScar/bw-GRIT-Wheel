import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
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

function bitwardenEmailValidator(): ValidatorFn {
  const pattern = /^[a-zA-Z0-9._%+-]+@bitwarden\.com$/i;
  return (control): ValidationErrors | null => {
    if (!control.value) return null;
    return pattern.test(control.value.trim()) ? null : { bitwardenEmail: true };
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
    nomineeEmail: ['', [Validators.required, bitwardenEmailValidator()]],
    gritCategory: ['' as GritCategory | '', [Validators.required]],
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

  onNomineeEmailChange(value: string): void {
    const match = this.knownPeople().find((p) => p.email.toLowerCase() === value.trim().toLowerCase());
    if (match && !this.form.get('nomineeName')?.value) {
      this.form.patchValue({ nomineeName: match.name });
    }
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
        nomineeEmail: value.nomineeEmail!.trim(),
        gritCategory: value.gritCategory as GritCategory,
        reason: value.reason!.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
          this.form.reset({ isAnonymous: false });
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

  get selectedCategoryDescription(): string | null {
    const category = this.form.get('gritCategory')?.value as GritCategory | '' | null;
    return category ? this.categoryDescriptions[category] : null;
  }
}
