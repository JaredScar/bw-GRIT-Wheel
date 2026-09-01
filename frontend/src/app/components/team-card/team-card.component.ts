import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { DirectoryPerson } from '../../models/directory-person.model';
import { Team } from '../../models/team.model';
import { PersonComboboxComponent } from '../person-combobox/person-combobox.component';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [PersonComboboxComponent, AvatarComponent],
  templateUrl: './team-card.component.html',
  styleUrl: './team-card.component.scss',
})
export class TeamCardComponent {
  @Input({ required: true }) team!: Team;
  @Input() directory: DirectoryPerson[] = [];
  @Input() busy = false;

  @Output() rename = new EventEmitter<string>();
  @Output() changeManager = new EventEmitter<string | null>();
  @Output() addMember = new EventEmitter<string>();
  @Output() removeMember = new EventEmitter<string>();
  @Output() deleteRequested = new EventEmitter<void>();

  editingName = false;
  nameDraft = '';
  editingManager = false;

  get memberEmails(): string[] {
    return this.team.members.map((member) => member.email);
  }

  get managerExcludeEmails(): string[] {
    return this.team.manager ? [this.team.manager.email] : [];
  }

  startEditingName(): void {
    this.editingName = true;
    this.nameDraft = this.team.name;
  }

  cancelEditingName(): void {
    this.editingName = false;
  }

  saveName(): void {
    const name = this.nameDraft.trim();
    if (!name) return;
    this.rename.emit(name);
    this.editingName = false;
  }

  startEditingManager(): void {
    this.editingManager = true;
  }

  cancelEditingManager(): void {
    this.editingManager = false;
  }

  pickManager(person: DirectoryPerson): void {
    this.changeManager.emit(person.email);
    this.editingManager = false;
  }

  clearManager(): void {
    this.changeManager.emit(null);
  }

  pickMember(person: DirectoryPerson): void {
    this.addMember.emit(person.email);
  }
}
