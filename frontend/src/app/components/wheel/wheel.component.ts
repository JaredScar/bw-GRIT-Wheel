import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Randomizer, RandomizerEntry, randomizerColor } from '../../models/randomizer.model';

/** @deprecated use `RandomizerEntry` from `models/randomizer.model` instead. */
export type WheelSegment = RandomizerEntry;

/** Matches `.wheel-wrap`'s `min(360px, 80vw)` sizing so labels stay responsive. */
const LABEL_RADIUS = 'min(122px, 27vw)';

@Component({
  selector: 'app-wheel',
  standalone: true,
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.scss',
})
export class WheelComponent implements Randomizer {
  @Input() segments: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  rotation = 0;
  spinning = false;

  segmentColor(index: number): string {
    return randomizerColor(index);
  }

  /** Cumulative start angles (in degrees) for each segment, weighted by segment.weight (default 1). */
  private cumulativeAngles(): number[] {
    const totalWeight = this.segments.reduce((sum, s) => sum + (s.weight ?? 1), 0) || 1;
    let accumulated = 0;
    const starts: number[] = [];
    for (const segment of this.segments) {
      starts.push((accumulated / totalWeight) * 360);
      accumulated += segment.weight ?? 1;
    }
    starts.push(360);
    return starts;
  }

  segmentMidAngle(index: number): number {
    const angles = this.cumulativeAngles();
    return angles[index] + (angles[index + 1] - angles[index]) / 2;
  }

  conicGradient(): string {
    if (!this.segments.length) return '#e2e6ef';
    const angles = this.cumulativeAngles();
    const stops = this.segments.map(
      (_, i) => `${this.segmentColor(i)} ${angles[i]}deg ${angles[i + 1]}deg`,
    );
    return `conic-gradient(${stops.join(', ')})`;
  }

  /**
   * Positions the (zero-size) arm at the segment's midpoint angle and radius. Rotate is
   * applied before the translate so the point swings to the right spot on the circle;
   * see `labelTransform` for how the label itself stays upright despite this rotation.
   */
  armTransform(index: number): string {
    return `rotate(${this.segmentMidAngle(index)}deg) translateY(calc(-1 * ${LABEL_RADIUS}))`;
  }

  /**
   * Counter-rotates the label by the same amount the arm rotated it by, so the text
   * always reads horizontally regardless of how few/wide the segments are — a label
   * rotated to match a 180deg segment would otherwise render sideways.
   */
  labelTransform(index: number): string {
    return `translate(-50%, -50%) rotate(${-this.segmentMidAngle(index)}deg)`;
  }

  spinTo(index: number, extraSpins = 6): void {
    if (this.spinning || !this.segments.length) return;
    this.spinning = true;

    const targetCenter = this.segmentMidAngle(index);
    const currentMod = ((this.rotation % 360) + 360) % 360;
    const delta = 360 - targetCenter - currentMod;
    const normalizedDelta = ((delta % 360) + 360) % 360;
    this.rotation += extraSpins * 360 + normalizedDelta;

    setTimeout(() => {
      this.spinning = false;
      this.spinFinished.emit(index);
    }, 4200);
  }

  reset(): void {
    this.rotation = 0;
    this.spinning = false;
  }
}
