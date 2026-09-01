import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  WritableSignal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { RandomizerStageComponent } from '../../components/randomizer-stage/randomizer-stage.component';
import { GRIT_CATEGORY_LABELS, GritCategory } from '../../models/grit-category';
import { Nomination } from '../../models/nomination.model';
import { RandomizerEntry } from '../../models/randomizer.model';
import { Round, RoundStatus, SpinResult, WheelEntry, WheelMode } from '../../models/round.model';
import { CelebrationService } from '../../services/celebration.service';
import { NominationService } from '../../services/nomination.service';
import { RoundService } from '../../services/round.service';
import { WinnerCardService } from '../../services/winner-card.service';

@Component({
  selector: 'app-admin-rounds-page',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, RouterLink, RandomizerStageComponent, AvatarComponent],
  templateUrl: './admin-rounds-page.component.html',
  styleUrl: './admin-rounds-page.component.scss',
})
export class AdminRoundsPageComponent implements OnInit, OnDestroy {
  @ViewChild('stageRef') private stage?: RandomizerStageComponent;
  @ViewChild('presentationStageEl') private presentationStageEl?: ElementRef<HTMLElement>;

  readonly RoundStatus = RoundStatus;
  readonly WheelMode = WheelMode;

  private readonly fb = inject(FormBuilder);
  private readonly roundService = inject(RoundService);
  private readonly nominationService = inject(NominationService);
  private readonly celebrationService = inject(CelebrationService);
  private readonly winnerCardService = inject(WinnerCardService);

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
  readonly allRounds = signal<Round[]>([]);
  readonly weightedWheel = signal(false);
  readonly sharingCard = signal(false);
  readonly cardError = signal<string | null>(null);

  readonly winnerNominations = signal<Nomination[]>([]);

  readonly testSpinning = signal(false);
  readonly testResult = signal<string | null>(null);
  readonly testResultNominations = signal<Nomination[]>([]);
  private testTargetIndex: number | null = null;

  readonly presentationMode = signal(false);
  private pendingSpinResult: SpinResult | null = null;

  get segments(): RandomizerEntry[] {
    return this.wheelEntries().map((e) => ({
      label: e.nomineeName,
      weight: this.weightedWheel() ? e.nominationIds.length : 1,
    }));
  }

  ngOnInit(): void {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    this.loadEverything();
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

  loadEverything(): void {
    this.loadingRound.set(true);
    this.roundService.getCurrent().subscribe({
      next: (round) => {
        this.currentRound.set(round);
        this.loadWheelEntries(round.id);

        if (round.status === RoundStatus.COMPLETED && round.winnerNomineeEmail) {
          this.loadNominationsFor(round.id, round.winnerNomineeEmail, this.winnerNominations);
        } else {
          this.winnerNominations.set([]);
        }
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

  private loadNominationsFor(
    roundId: string,
    nomineeEmail: string,
    target: WritableSignal<Nomination[]>,
  ): void {
    target.set([]);
    this.nominationService.findAll({ roundId, nomineeEmail }).subscribe({
      next: (nominations) => target.set(nominations),
      error: () => target.set([]),
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
          this.winnerNominations.set([]);
          this.wheelEntries.set([]);
          this.testResult.set(null);
          this.testResultNominations.set([]);
          this.stage?.reset();
          this.loadEverything();
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
    this.testResult.set(null);
    this.testResultNominations.set([]);
    this.winner.set(null);
    this.winnerNominations.set([]);
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

  /**
   * Spins the same stage over the real current-round nominees, purely client-side — no
   * backend call, no round mutation, no persisted winner. Lets an admin see how a style
   * looks/feels with the real list before committing to the real spin.
   */
  testSpin(): void {
    const entries = this.wheelEntries();
    if (this.spinning() || entries.length === 0) return;

    this.testResult.set(null);
    this.testResultNominations.set([]);
    this.spinning.set(true);
    this.testSpinning.set(true);

    const index = this.pickRandomIndex(entries);
    this.testTargetIndex = index;

    setTimeout(() => {
      this.stage?.spinTo(index);
    }, 50);
  }

  private pickRandomIndex(entries: WheelEntry[]): number {
    if (!this.weightedWheel()) {
      return Math.floor(Math.random() * entries.length);
    }
    const totalWeight = entries.reduce((sum, e) => sum + e.nominationIds.length, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < entries.length; i++) {
      roll -= entries[i].nominationIds.length;
      if (roll < 0) return i;
    }
    return entries.length - 1;
  }

  onSpinFinished(): void {
    if (this.testSpinning()) {
      const index = this.testTargetIndex;
      const entry = index !== null ? this.wheelEntries()[index] : null;
      const round = this.currentRound();
      this.testSpinning.set(false);
      this.spinning.set(false);
      this.testTargetIndex = null;
      this.testResult.set(entry?.nomineeName ?? null);
      if (entry && round) {
        this.loadNominationsFor(round.id, entry.nomineeEmail, this.testResultNominations);
      } else {
        this.testResultNominations.set([]);
      }
      return;
    }

    const result = this.pendingSpinResult;
    if (!result) return;
    this.pendingSpinResult = null;
    this.currentRound.set(result.round);
    this.winner.set(result.winner);
    this.spinning.set(false);
    this.celebrationService.celebrate();
    this.loadEverything();
    this.loadNominationsFor(result.round.id, result.winner.nomineeEmail, this.winnerNominations);
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

  categoryBadgeClass(category: GritCategory): string {
    return `badge-${category.toLowerCase()}`;
  }

  nominatorDisplayName(nomination: Nomination): string {
    return nomination.isAnonymous || !nomination.nominatorName
      ? 'Anonymous'
      : nomination.nominatorName;
  }
}
