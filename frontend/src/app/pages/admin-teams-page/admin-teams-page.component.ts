import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';
import { PersonComboboxComponent } from '../../components/person-combobox/person-combobox.component';
import { TeamCardComponent } from '../../components/team-card/team-card.component';
import { DirectoryPerson } from '../../models/directory-person.model';
import { Team } from '../../models/team.model';
import { DirectoryService } from '../../services/directory.service';
import { TeamsService } from '../../services/teams.service';

@Component({
  selector: 'app-admin-teams-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PersonComboboxComponent,
    TeamCardComponent,
    ConfirmDialogComponent,
    AvatarComponent,
  ],
  templateUrl: './admin-teams-page.component.html',
  styleUrl: './admin-teams-page.component.scss',
})
export class AdminTeamsPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly teamsService = inject(TeamsService);
  private readonly directoryService = inject(DirectoryService);

  readonly teams = signal<Team[]>([]);
  readonly loadingTeams = signal(false);
  readonly teamsError = signal<string | null>(null);

  readonly directory = signal<DirectoryPerson[]>([]);
  readonly directoryLoadError = signal<string | null>(null);

  readonly newTeamForm = this.fb.group({ name: ['', [Validators.required]] });
  readonly newTeamManagerEmail = signal<string | null>(null);
  readonly newTeamManagerName = signal<string | null>(null);
  readonly creatingTeam = signal(false);
  readonly createTeamError = signal<string | null>(null);

  /** Shared across all team-card actions (rename/manager/members) — only one is ever
   * in flight at a time in practice, so a single banner + busy id keeps this simple. */
  readonly busyTeamId = signal<string | null>(null);
  readonly teamActionError = signal<string | null>(null);

  readonly teamPendingDelete = signal<Team | null>(null);
  readonly deletingTeam = signal(false);
  readonly deleteTeamError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTeams();
    this.directoryService.listAll().subscribe({
      next: (people) => this.directory.set(people),
      error: () => {
        this.directoryLoadError.set(
          'Unable to load the directory. Please refresh the page and try again.',
        );
      },
    });
  }

  loadTeams(): void {
    this.loadingTeams.set(true);
    this.teamsError.set(null);
    this.teamsService.listAll().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.loadingTeams.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loadingTeams.set(false);
        this.teamsError.set(err.error?.message ?? 'Unable to load teams.');
      },
    });
  }

  pickNewTeamManager(person: DirectoryPerson): void {
    this.newTeamManagerEmail.set(person.email);
    this.newTeamManagerName.set(person.name);
  }

  clearNewTeamManager(): void {
    this.newTeamManagerEmail.set(null);
    this.newTeamManagerName.set(null);
  }

  createTeam(): void {
    this.createTeamError.set(null);
    if (this.newTeamForm.invalid) {
      this.newTeamForm.markAllAsTouched();
      return;
    }

    this.creatingTeam.set(true);
    const name = this.newTeamForm.getRawValue().name!.trim();
    const managerEmail = this.newTeamManagerEmail() ?? undefined;

    this.teamsService.create(name, managerEmail).subscribe({
      next: (team) => {
        this.creatingTeam.set(false);
        this.newTeamForm.reset();
        this.clearNewTeamManager();
        this.teams.update((teams) => [...teams, team].sort((a, b) => a.name.localeCompare(b.name)));
      },
      error: (err: HttpErrorResponse) => {
        this.creatingTeam.set(false);
        this.createTeamError.set(err.error?.message ?? 'Unable to create that team.');
      },
    });
  }

  onRename(team: Team, name: string): void {
    this.runTeamAction(team.id, this.teamsService.rename(team.id, name));
  }

  onChangeManager(team: Team, managerEmail: string | null): void {
    this.runTeamAction(team.id, this.teamsService.setManager(team.id, managerEmail));
  }

  onAddMember(team: Team, email: string): void {
    const emails = [...team.members.map((m) => m.email), email];
    this.runTeamAction(team.id, this.teamsService.setMembers(team.id, emails));
  }

  onRemoveMember(team: Team, email: string): void {
    const emails = team.members.map((m) => m.email).filter((e) => e !== email);
    this.runTeamAction(team.id, this.teamsService.setMembers(team.id, emails));
  }

  private runTeamAction(teamId: string, request: ReturnType<TeamsService['rename']>): void {
    this.teamActionError.set(null);
    this.busyTeamId.set(teamId);
    request.subscribe({
      next: (updated) => {
        this.busyTeamId.set(null);
        this.teams.update((teams) => teams.map((t) => (t.id === updated.id ? updated : t)));
      },
      error: (err: HttpErrorResponse) => {
        this.busyTeamId.set(null);
        this.teamActionError.set(err.error?.message ?? 'Unable to update that team.');
      },
    });
  }

  confirmDeleteTeam(team: Team): void {
    this.deleteTeamError.set(null);
    this.teamPendingDelete.set(team);
  }

  cancelDeleteTeam(): void {
    this.teamPendingDelete.set(null);
    this.deleteTeamError.set(null);
  }

  deleteTeam(): void {
    const team = this.teamPendingDelete();
    if (!team || this.deletingTeam()) return;

    this.deleteTeamError.set(null);
    this.deletingTeam.set(true);
    this.teamsService.remove(team.id).subscribe({
      next: () => {
        this.deletingTeam.set(false);
        this.teams.update((teams) => teams.filter((t) => t.id !== team.id));
        this.teamPendingDelete.set(null);
      },
      error: (err: HttpErrorResponse) => {
        this.deletingTeam.set(false);
        this.deleteTeamError.set(err.error?.message ?? 'Unable to delete that team.');
      },
    });
  }
}
