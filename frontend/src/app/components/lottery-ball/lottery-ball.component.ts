import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { Randomizer, RandomizerEntry, initialsOf, randomizerColor } from '../../models/randomizer.model';

const TUMBLE_DURATION_MS = 3200;
const REVEAL_HOLD_MS = 900;

@Component({
  selector: 'app-lottery-ball',
  standalone: true,
  templateUrl: './lottery-ball.component.html',
  styleUrl: './lottery-ball.component.scss',
})
export class LotteryBallComponent implements Randomizer, OnChanges, OnDestroy {
  @Input() entries: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  tumbling = false;
  winnerIndex: number | null = null;
  spinning = false;

  /** Precomputed per-ball jitter offsets so they don't re-randomize every change detection tick. */
  jitterOffsets: { x: number; y: number; duration: number; delay: number }[] = [];

  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastEntryCount = -1;

  ngOnChanges(): void {
    if (this.entries.length !== this.lastEntryCount) {
      this.lastEntryCount = this.entries.length;
      this.jitterOffsets = this.entries.map(() => ({
        x: Math.round((Math.random() - 0.5) * 10),
        y: Math.round((Math.random() - 0.5) * 10),
        duration: 0.35 + Math.random() * 0.3,
        delay: Math.random() * 0.4,
      }));
    }
    if (!this.spinning) {
      this.tumbling = false;
      this.winnerIndex = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  ballColor(index: number): string {
    return randomizerColor(index);
  }

  private jitterFor(index: number): { x: number; y: number; duration: number; delay: number } {
    return this.jitterOffsets[index] ?? { x: 0, y: 0, duration: 0.4, delay: 0 };
  }

  jitterX(index: number): number {
    return this.jitterFor(index).x;
  }

  jitterY(index: number): number {
    return this.jitterFor(index).y;
  }

  jitterDuration(index: number): number {
    return this.jitterFor(index).duration;
  }

  jitterDelay(index: number): number {
    return this.jitterFor(index).delay;
  }

  initials(label: string): string {
    return initialsOf(label);
  }

  get winnerEntry(): RandomizerEntry | null {
    return this.winnerIndex !== null ? this.entries[this.winnerIndex] : null;
  }

  spinTo(targetIndex: number): void {
    if (this.spinning || !this.entries.length) return;
    this.spinning = true;
    this.winnerIndex = null;
    this.tumbling = true;

    this.timeoutId = setTimeout(() => {
      this.tumbling = false;
      this.winnerIndex = targetIndex;
      this.timeoutId = setTimeout(() => {
        this.spinning = false;
        this.spinFinished.emit(targetIndex);
      }, REVEAL_HOLD_MS);
    }, TUMBLE_DURATION_MS);
  }

  reset(): void {
    this.clearTimer();
    this.spinning = false;
    this.tumbling = false;
    this.winnerIndex = null;
  }

  private clearTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
