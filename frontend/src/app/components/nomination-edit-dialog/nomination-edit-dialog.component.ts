import { Component, EventEmitter, Input, OnInit, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Output } from '@angular/core';
import { DirectoryPerson } from '../../models/directory-person.model';
import {
  GRIT_CATEGORIES,
  GRIT_CATEGORY_LABELS,
  GritCategory,
} from '../../models/grit-category';
import { Nomination, UpdateNominationPayload } from '../../models/nomination.model';
import { DirectoryService } from '../../services/directory.service';

const MAX_SUGGESTIONS = 8;
const BITWARDEN_EMAIL_PATTERN = /^[^\s@]+@bitwarden\.com$/i;

function minSelectionValidator(min: number): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = (control.value as unknown[] | null) ?? [];
    return value.length >= min ? null : { minSelection: true };
  };
}

/**
 * Admin-only correction dialog. Mirrors the fields (and the nominee combobox) of the
 * nominate form, minus the nominator: that identity comes from the original submitter's
 * verified sign-in and isn't an admin's to reassign.
 */
@Component({
  selector: 'app-nomination-edit-dialog',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './nomination-edit-dialog.component.html',
  styleUrl: './nomination-edit-dialog.component.scss',
})
export class NominationEditDialogComponent implements OnInit {
  @Input({ required: true }) nomination!: Nomination;
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() saved = new EventEmitter<UpdateNominationPayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly gritCategories = GRIT_CATEGORIES;
  readonly categoryLabels = GRIT_CATEGORY_LABELS;

  private readonly fb = inject(FormBuilder);
  private readonly directoryService = inject(DirectoryService);

  readonly directory = signal<DirectoryPerson[]>([]);
  readonly directoryLoadError = signal<string | null>(null);
  readonly nomineeQuery = signal('');
  readonly showSuggestions = signal(false);
  readonly addingNewNominee = signal(false);
  readonly newNomineeConfirmed = signal(false);

  readonly nomineeMatches = computed(() => {
    const term = this.nomineeQuery().trim().toLowerCase();
    const people = this.directory();
    if (!term) return people.slice(0, MAX_SUGGESTIONS);
    return people.filter((p) => p.name.toLowerCase().includes(term)).slice(0, MAX_SUGGESTIONS);
  });

  readonly newNomineeEmailControl = this.fb.control('', [
    Validators.required,
    Validators.pattern(BITWARDEN_EMAIL_PATTERN),
  ]);

  readonly form = this.fb.group({
    isAnonymous: [false],
    nomineeEmail: ['', [Validators.required]],
    gritCategories: this.fb.control<GritCategory[]>([], [minSelectionValidator(1)]),
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  /** The nominator, shown read-only so an admin can see who they're editing on behalf of. */
  get nominatorLabel(): string {
    if (this.nomination.isAnonymous) {
      return 'Anonymous (hidden from the feed)';
    }
    return this.nomination.nominatorName ?? 'Unknown';
  }

  ngOnInit(): void {
    this.form.patchValue({
      isAnonymous: this.nomination.isAnonymous,
      nomineeEmail: this.nomination.nomineeEmail,
      gritCategories: [...this.nomination.gritCategories],
      reason: this.nomination.reason,
    });
    this.nomineeQuery.set(this.nomination.nomineeName);

    this.directoryService.listAll().subscribe({
      next: (people) => this.directory.set(people),
      error: () =>
        this.directoryLoadError.set(
          'Unable to load the nominee directory, so the nominee can\'t be changed right now.',
        ),
    });
  }

  onNomineeInput(value: string): void {
    this.nomineeQuery.set(value);
    this.showSuggestions.set(true);
    this.addingNewNominee.set(false);
    this.newNomineeConfirmed.set(false);
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
    this.addingNewNominee.set(false);
    this.newNomineeConfirmed.set(false);
  }

  promptAddNewNominee(event: Event): void {
    event.preventDefault();
    this.newNomineeEmailControl.reset('');
    this.addingNewNominee.set(true);
  }

  confirmAddNewNominee(): void {
    this.newNomineeEmailControl.markAsTouched();
    if (this.newNomineeEmailControl.invalid) {
      return;
    }

    const email = (this.newNomineeEmailControl.value ?? '').trim().toLowerCase();
    this.form.get('nomineeEmail')!.setValue(email);
    this.form.get('nomineeEmail')!.markAsTouched();
    this.newNomineeConfirmed.set(true);
    this.addingNewNominee.set(false);
    this.showSuggestions.set(false);
  }

  cancelAddNewNominee(): void {
    this.addingNewNominee.set(false);
    this.newNomineeEmailControl.reset('');
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      isAnonymous: !!value.isAnonymous,
      nomineeEmail: value.nomineeEmail!,
      nomineeName: this.newNomineeConfirmed() ? this.nomineeQuery().trim() : undefined,
      gritCategories: value.gritCategories!,
      reason: value.reason!.trim(),
    });
  }
}
