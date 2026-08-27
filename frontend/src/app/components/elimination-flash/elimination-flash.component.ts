import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Randomizer, RandomizerEntry } from '../../models/randomizer.model';

const TOTAL_DURATION_MS = 4200;
const MIN_STEP_DELAY_MS = 45;
const MAX_STEP_DELAY_MS = 420;

@Component({
  selector: 'app-elimination-flash',
  standalone: true,
  templateUrl: './elimination-flash.component.html',
  styleUrl: './elimination-flash.component.scss',
})
export class EliminationFlashComponent implements Randomizer, OnChanges, OnDestroy {
  @Input() entries: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  highlightedIndex: number | null = null;
  winnerIndex: number | null = null;
  spinning = false;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(): void {
    if (!this.spinning) {
      this.highlightedIndex = null;
      this.winnerIndex = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  spinTo(targetIndex: number, extraSpins = 4): void {
    if (this.spinning || !this.entries.length) return;
    this.spinning = true;
    this.winnerIndex = null;

    const loopLength = this.entries.length;
    const totalSteps = extraSpins * loopLength + targetIndex + 1;
    const delays = this.buildDelays(totalSteps);

    let step = 0;
    const tick = (): void => {
      this.highlightedIndex = step % loopLength;
      const isLast = step === totalSteps - 1;
      step++;

      if (isLast) {
        this.winnerIndex = this.highlightedIndex;
        this.spinning = false;
        this.spinFinished.emit(targetIndex);
        return;
      }

      this.timeoutId = setTimeout(tick, delays[step]);
    };
    tick();
  }

  reset(): void {
    this.clearTimer();
    this.spinning = false;
    this.highlightedIndex = null;
    this.winnerIndex = null;
  }

  /** Delays scaled to sum to roughly TOTAL_DURATION_MS, slowest near the end (deceleration). */
  private buildDelays(totalSteps: number): number[] {
    if (totalSteps <= 1) return [0];
    const weights = Array.from({ length: totalSteps }, (_, i) => Math.pow((i + 1) / totalSteps, 3));
    const weightSum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => {
      const scaled = (w / weightSum) * TOTAL_DURATION_MS;
      return Math.min(MAX_STEP_DELAY_MS, Math.max(MIN_STEP_DELAY_MS, scaled));
    });
  }

  private clearTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
