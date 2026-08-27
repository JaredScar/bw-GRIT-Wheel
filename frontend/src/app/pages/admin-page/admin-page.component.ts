import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { RandomizerStageComponent } from '../../components/randomizer-stage/randomizer-stage.component';
import { AnalyticsSummary } from '../../models/analytics.model';
import { DirectoryImportSummary } from '../../models/directory-person.model';
import { GRIT_CATEGORY_LABELS, GritCategory } from '../../models/grit-category';
import { RandomizerEntry } from '../../models/randomizer.model';
import { Round, RoundStatus, SpinResult, WheelEntry, WheelMode } from '../../models/round.model';
import { AnalyticsService } from '../../services/analytics.service';
import { AuthService } from '../../services/auth.service';
import { CelebrationService } from '../../services/celebration.service';
import { DirectoryService } from '../../services/directory.service';
import { RoundService } from '../../services/round.service';
import { WinnerCardService } from '../../services/winner-card.service';

const PREVIEW_NAME_POOL = [
  'Alex Rivera', 'Jordan Kim', 'Sam Patel', 'Morgan Chen', 'Taylor Nguyen',
  'Casey Brooks', 'Riley Johnson', 'Drew Sanders', 'Avery Collins', 'Reese Bennett',
  'Quinn Foster', 'Skyler Reed', 'Rowan Hayes', 'Emerson Blake', 'Finley Cross',
  'Harper Doyle', 'Sawyer Grant', 'Elliot Price', 'Marlowe Stone', 'Peyton Wells',
  'Dakota Shaw', 'Kendall Ford', 'Blake Sullivan', 'Cameron Ortiz', 'Jamie Whitfield',
  'Morgan Delgado', 'Charlie Novak', 'Frankie Marsh', 'Robin Castillo', 'Ash Kingston',
  'Toni Marlowe', 'Val Ashford', 'Remy Donovan', 'Sage Whitmore', 'Lane Prescott',
  'Bailey Emerson', 'Sydney Holt', 'Micah Vance', 'Noel Ramsey', 'Jules Winslow',
  'Devon Ashby', 'Reign Calloway', 'Shiloh Merritt', 'Justice Blackwood', 'Rory Fenwick',
  'Wren Abernathy', 'Story Caldwell', 'Indigo Beaumont', 'Phoenix Radcliffe', 'Sunny Vaughn',
];

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, RouterLink, RandomizerStageComponent, AvatarComponent],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit, OnDestroy {
  @ViewChild('stageRef') private stage?: RandomizerStageComponent;
  @ViewChild('previewStageRef') private previewStage?: RandomizerStageComponent;
  @ViewChild('presentationStageEl') private presentationStageEl?: ElementRef<HTMLElement>;

  readonly RoundStatus = RoundStatus;
  readonly WheelMode = WheelMode;

  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly roundService = inject(RoundService);
  private readonly celebrationService = inject(CelebrationService);
  private readonly winnerCardService = inject(WinnerCardService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly directoryService = inject(DirectoryService);

  readonly categoryLabels = GRIT_CATEGORY_LABELS;

  readonly newRoundForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    eventDate: [''],
  });

  readonly currentRound = signal<Round | null>(null);
  readonly wheelEntries = signal<WheelEntry[]>([]);
  readonly loadingRound = signal(true);
  readonly creatingRound = signal(false);
  readonly createRoundError = signal<string | null>(null);
  readonly spinning = signal(false);
  readonly spinError = signal<string | null>(null);
  readonly winner = signal<WheelEntry | null>(null);
  readonly winningReasons = signal<string[]>([]);
  readonly allRounds = signal<Round[]>([]);
  readonly weightedWheel = signal(false);
  readonly sharingCard = signal(false);
  readonly cardError = signal<string | null>(null);

  readonly analytics = signal<AnalyticsSummary | null>(null);
  readonly loadingAnalytics = signal(false);

  readonly directoryCount = signal(0);
  readonly selectedCsvFile = signal<File | null>(null);
  readonly importingDirectory = signal(false);
  readonly directoryImportError = signal<string | null>(null);
  readonly directoryImportSummary = signal<DirectoryImportSummary | null>(null);

  readonly presentationMode = signal(false);
  private pendingSpinResult: SpinResult | null = null;

  readonly previewCount = signal(10);
  readonly previewNames = signal<string[]>([]);
  readonly previewSpinning = signal(false);
  readonly previewWinner = signal<string | null>(null);
  readonly previewPoolSize = PREVIEW_NAME_POOL.length;
  private previewTargetIndex: number | null = null;

  get segments(): RandomizerEntry[] {
    return this.wheelEntries().map((e) => ({
      label: e.nomineeName,
      weight: this.weightedWheel() ? e.nominationIds.length : 1,
    }));
  }

  get previewSegments(): RandomizerEntry[] {
    return this.previewNames().map((label) => ({ label }));
  }

  async ngOnInit(): Promise<void> {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.shufflePreviewNames();

    await this.authService.ready;
    if (this.authService.isAdmin()) {
      this.loadEverything();
      this.loadAnalytics();
      this.loadDirectoryCount();
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
  }

  private readonly onFullscreenChange = (): void => {
    this.presentationMode.set(!!document.fullscreenElement);
  };

  async enterPresentationMode(): Promise<void> {
    const el = this.presentationStageEl?.nativeElement;
    try {
      await el?.requestFullscreen();
    } catch {
      // Fullscreen can be blocked (e.g. embedded contexts); still show the decluttered view.
      this.presentationMode.set(true);
    }
  }

  async exitPresentationMode(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    this.presentationMode.set(false);
  }

  loadDirectoryCount(): void {
    this.directoryService.listAll().subscribe({
      next: (people) => this.directoryCount.set(people.length),
      error: () => {
        // Non-critical for this card; the import button still works either way.
      },
    });
  }

  onDirectoryFileSelected(files: FileList | null): void {
    this.directoryImportError.set(null);
    this.directoryImportSummary.set(null);
    this.selectedCsvFile.set(files?.[0] ?? null);
  }

  importDirectory(fileInput: HTMLInputElement): void {
    const file = this.selectedCsvFile();
    if (!file || this.importingDirectory()) return;

    this.directoryImportError.set(null);
    this.directoryImportSummary.set(null);
    this.importingDirectory.set(true);

    file
      .text()
      .then((csv) =>
        this.directoryService.importCsv(csv).subscribe({
          next: (summary) => {
            this.importingDirectory.set(false);
            this.directoryImportSummary.set(summary);
            this.selectedCsvFile.set(null);
            fileInput.value = '';
            this.loadDirectoryCount();
          },
          error: (err: HttpErrorResponse) => {
            this.importingDirectory.set(false);
            this.directoryImportError.set(err.error?.message ?? 'Unable to import that CSV file.');
          },
        }),
      )
      .catch(() => {
        this.importingDirectory.set(false);
        this.directoryImportError.set('Unable to read that file.');
      });
  }

  loadEverything(): void {
    this.loadingRound.set(true);
    this.roundService.getCurrent().subscribe({
      next: (round) => {
        this.currentRound.set(round);
        this.winner.set(null);
        this.loadWheelEntries(round.id);
      },
      error: () => this.loadingRound.set(false),
    });
    this.roundService.findAll().subscribe((rounds) => this.allRounds.set(rounds));
  }

  loadWheelEntries(roundId: string): void {
    this.roundService.getWheelEntries(roundId).subscribe({
      next: (entries) => {
        this.wheelEntries.set(entries);
        this.loadingRound.set(false);
      },
      error: () => this.loadingRound.set(false),
    });
  }

  createRound(): void {
    this.createRoundError.set(null);
    if (this.newRoundForm.invalid) {
      this.newRoundForm.markAllAsTouched();
      return;
    }
    this.creatingRound.set(true);
    const value = this.newRoundForm.getRawValue();
    this.roundService
      .createRound({
        title: value.title!.trim(),
        eventDate: value.eventDate || undefined,
      })
      .subscribe({
        next: (round) => {
          this.creatingRound.set(false);
          this.newRoundForm.reset();
          this.currentRound.set(round);
          this.winner.set(null);
          this.wheelEntries.set([]);
          this.stage?.reset();
          this.loadEverything();
          this.loadAnalytics();
        },
        error: (err: HttpErrorResponse) => {
          this.creatingRound.set(false);
          this.createRoundError.set(err.error?.message ?? 'Unable to create round.');
        },
      });
  }

  spinWheel(): void {
    const round = this.currentRound();
    if (!round || this.spinning()) return;

    this.spinError.set(null);
    this.spinning.set(true);

    this.roundService.spin(round.id, this.weightedWheel()).subscribe({
      next: (result) => {
        this.wheelEntries.set(result.entries);
        this.pendingSpinResult = result;
        const index = result.entries.findIndex(
          (e) => e.nomineeEmail === result.winner.nomineeEmail,
        );

        setTimeout(() => {
          this.stage?.spinTo(index < 0 ? 0 : index);
        }, 50);
      },
      error: (err: HttpErrorResponse) => {
        this.spinning.set(false);
        this.spinError.set(err.error?.message ?? 'Unable to spin the wheel.');
      },
    });
  }

  onSpinFinished(): void {
    const result = this.pendingSpinResult;
    if (!result) return;
    this.pendingSpinResult = null;
    this.currentRound.set(result.round);
    this.winner.set(result.winner);
    this.spinning.set(false);
    this.celebrationService.celebrate();
    this.loadEverything();
  }

  shufflePreviewNames(): void {
    const count = Math.max(1, Math.min(this.previewPoolSize, Math.round(this.previewCount())));
    const pool = [...PREVIEW_NAME_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.previewNames.set(pool.slice(0, count));
    this.previewWinner.set(null);
  }

  onPreviewCountChange(value: string): void {
    const parsed = parseInt(value, 10);
    this.previewCount.set(Number.isFinite(parsed) ? parsed : 1);
    this.shufflePreviewNames();
  }

  spinPreview(): void {
    if (this.previewSpinning() || this.previewNames().length === 0) return;
    this.previewSpinning.set(true);
    this.previewWinner.set(null);

    const targetIndex = Math.floor(Math.random() * this.previewNames().length);
    this.previewTargetIndex = targetIndex;

    setTimeout(() => {
      this.previewStage?.spinTo(targetIndex);
    }, 50);
  }

  onPreviewSpinFinished(): void {
    const index = this.previewTargetIndex;
    this.previewSpinning.set(false);
    this.previewTargetIndex = null;
    if (index !== null) {
      this.previewWinner.set(this.previewNames()[index] ?? null);
    }
  }

  async shareWinnerCard(name: string, email: string): Promise<void> {
    const round = this.currentRound();
    if (!round) return;

    this.cardError.set(null);
    this.sharingCard.set(true);
    try {
      await this.winnerCardService.shareOrDownload({ name, email, roundTitle: round.title });
    } catch {
      this.cardError.set('Unable to generate the winner card.');
    } finally {
      this.sharingCard.set(false);
    }
  }

  loadAnalytics(): void {
    this.loadingAnalytics.set(true);
    this.analyticsService.getSummary().subscribe({
      next: (summary) => {
        this.analytics.set(summary);
        this.loadingAnalytics.set(false);
      },
      error: () => this.loadingAnalytics.set(false),
    });
  }

  barWidth(count: number, rows: { count: number }[]): number {
    const max = Math.max(...rows.map((r) => r.count), 1);
    return (count / max) * 100;
  }

  categoryBadgeClass(category: GritCategory): string {
    return `badge-${category.toLowerCase()}`;
  }
}
