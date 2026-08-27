import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Randomizer, RandomizerEntry } from '../../models/randomizer.model';

const FLICKER_COUNT = 10;
const FLICKER_DURATION_MS = 2600;
const REVEAL_DELAY_MS = 500;
/** Extra pause after the winner's card flips open before spinFinished fires. */
const REVEAL_HOLD_MS = 1100;

@Component({
  selector: 'app-card-flip',
  standalone: true,
  templateUrl: './card-flip.component.html',
  styleUrl: './card-flip.component.scss',
})
export class CardFlipComponent implements Randomizer, OnChanges, OnDestroy {
  @Input() entries: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  flippedIndex: number | null = null;
  winnerIndex: number | null = null;
  spinning = false;

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(): void {
    if (!this.spinning) {
      this.flippedIndex = null;
      this.winnerIndex = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  spinTo(targetIndex: number): void {
    if (this.spinning || !this.entries.length) return;
    this.spinning = true;
    this.winnerIndex = null;

    const n = this.entries.length;
    let flickers = 0;
    const flickerStep = (): void => {
      if (flickers >= FLICKER_COUNT) {
        this.flippedIndex = null;
        this.timeoutId = setTimeout(() => {
          this.winnerIndex = targetIndex;
          this.flippedIndex = targetIndex;
          this.timeoutId = setTimeout(() => {
            this.spinning = false;
            this.spinFinished.emit(targetIndex);
          }, REVEAL_HOLD_MS);
        }, REVEAL_DELAY_MS);
        return;
      }

      // Never flicker the target card itself before the final reveal, so its flip
      // always reads as "the" reveal rather than one of many random flips.
      let candidate = Math.floor(Math.random() * n);
      if (n > 1 && candidate === targetIndex) {
        candidate = (candidate + 1) % n;
      }
      this.flippedIndex = candidate;
      flickers++;
      this.timeoutId = setTimeout(flickerStep, FLICKER_DURATION_MS / FLICKER_COUNT);
    };
    flickerStep();
  }

  reset(): void {
    this.clearTimer();
    this.spinning = false;
    this.flippedIndex = null;
    this.winnerIndex = null;
  }

  private clearTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
