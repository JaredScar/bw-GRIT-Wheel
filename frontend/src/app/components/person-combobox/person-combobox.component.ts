import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { DirectoryPerson } from '../../models/directory-person.model';

const MAX_SUGGESTIONS = 8;

/** Search-and-pick-one-person widget backed by the directory roster. Always clears its
 * own query and closes the dropdown after a pick — callers reflect the chosen person in
 * their own surrounding UI rather than leaving it sitting in this input. */
@Component({
  selector: 'app-person-combobox',
  standalone: true,
  templateUrl: './person-combobox.component.html',
  styleUrl: './person-combobox.component.scss',
})
export class PersonComboboxComponent {
  @Input() people: DirectoryPerson[] = [];
  @Input() excludeEmails: string[] = [];
  @Input() placeholder = 'Start typing a name...';
  @Input() emptyMessage =
    "No one found. Ask an admin to import the latest team roster if this person is missing.";
  @Input() excludedOnlyMessage = "That person is already selected.";

  @Output() picked = new EventEmitter<DirectoryPerson>();

  readonly query = signal('');
  readonly showSuggestions = signal(false);

  readonly matches = computed(() => {
    const term = this.query().trim().toLowerCase();
    const excluded = new Set(this.excludeEmails.map((email) => email.toLowerCase()));
    const pool = this.people.filter((person) => !excluded.has(person.email.toLowerCase()));
    const filtered = term ? pool.filter((person) => person.name.toLowerCase().includes(term)) : pool;
    return filtered.slice(0, MAX_SUGGESTIONS);
  });

  /** True when a name match exists but was filtered out by excludeEmails, so the
   * dropdown can say "already selected" instead of the misleading "not in the
   * directory" message. */
  readonly matchesExcludedOnly = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term || this.matches().length > 0) return false;
    return this.people.some((person) => person.name.toLowerCase().includes(term));
  });

  onInput(value: string): void {
    this.query.set(value);
    this.showSuggestions.set(true);
  }

  onFocus(): void {
    this.showSuggestions.set(true);
  }

  onBlur(): void {
    this.showSuggestions.set(false);
  }

  pick(person: DirectoryPerson, event: Event): void {
    event.preventDefault();
    this.picked.emit(person);
    this.query.set('');
    this.showSuggestions.set(false);
  }
}
