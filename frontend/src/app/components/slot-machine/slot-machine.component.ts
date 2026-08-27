import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Randomizer, RandomizerEntry } from '../../models/randomizer.model';

/** Must match the `.slot__item` height in slot-machine.component.scss. */
const ITEM_HEIGHT_PX = 64;
/** Rows visible in the window at once; the middle one is the "result" row. */
const VISIBLE_ROWS = 3;

@Component({
  selector: 'app-slot-machine',
  standalone: true,
  templateUrl: './slot-machine.component.html',
  styleUrl: './slot-machine.component.scss',
})
export class SlotMachineComponent implements Randomizer, OnChanges {
  @Input() entries: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  readonly itemHeight = ITEM_HEIGHT_PX;

  reelItems: RandomizerEntry[] = [];
  offsetPx = 0;
  animating = false;
  spinning = false;

  ngOnChanges(): void {
    if (!this.spinning) {
      this.showIdlePreview();
    }
  }

  spinTo(targetIndex: number, extraSpins = 6): void {
    if (this.spinning || !this.entries.length) return;
    this.spinning = true;

    const loopLength = this.entries.length;
    const repeats = extraSpins + 2;
    const reel: RandomizerEntry[] = [];
    for (let i = 0; i < repeats; i++) {
      reel.push(...this.entries);
    }
    this.reelItems = reel;

    const targetReelIndex = extraSpins * loopLength + targetIndex;

    // Snap back to the top with transitions off, then let the browser register that
    // before re-enabling the transition and animating to the target — otherwise the
    // browser coalesces the reset and the animated move into one instant jump.
    this.animating = false;
    this.offsetPx = 0;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.animating = true;
        this.offsetPx = -(targetReelIndex - Math.floor(VISIBLE_ROWS / 2)) * this.itemHeight;
      });
    });

    setTimeout(() => {
      this.spinning = false;
      this.spinFinished.emit(targetIndex);
    }, 4200);
  }

  reset(): void {
    this.animating = false;
    this.spinning = false;
    this.offsetPx = 0;
    this.showIdlePreview();
  }

  private showIdlePreview(): void {
    // Pad so there's always a "next" row under the top preview item, even with 1 entry.
    const padded = this.entries.length ? this.entries : [];
    this.reelItems = padded.length
      ? [...padded, ...padded, ...padded].slice(0, Math.max(VISIBLE_ROWS, padded.length))
      : [];
  }
}
