import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Randomizer, RandomizerEntry, randomizerColor } from '../../models/randomizer.model';

/** @deprecated use `RandomizerEntry` from `models/randomizer.model` instead. */
export type WheelSegment = RandomizerEntry;

const SVG_SIZE = 200;
const SVG_CENTER = SVG_SIZE / 2;
const SVG_RADIUS = 96;

@Component({
  selector: 'app-wheel',
  standalone: true,
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.scss',
})
export class WheelComponent implements Randomizer {
  @Input() segments: RandomizerEntry[] = [];
  @Input() hoveredIndex: number | null = null;
  @Output() hoveredIndexChange = new EventEmitter<number | null>();
  @Output() spinFinished = new EventEmitter<number>();

  readonly svgSize = SVG_SIZE;

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

  /** SVG arc path for one wedge, so each segment is its own hoverable element. */
  segmentPath(index: number): string {
    const angles = this.cumulativeAngles();
    const start = angles[index];
    const end = angles[index + 1];
    const largeArc = end - start > 180 ? 1 : 0;
    const p1 = this.pointOnCircle(start);
    const p2 = this.pointOnCircle(end);
    return `M ${SVG_CENTER},${SVG_CENTER} L ${p1.x},${p1.y} A ${SVG_RADIUS},${SVG_RADIUS} 0 ${largeArc} 1 ${p2.x},${p2.y} Z`;
  }

  /** `angleDeg` uses the same 0deg-at-top, clockwise convention as the rest of the wheel. */
  private pointOnCircle(angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: SVG_CENTER + SVG_RADIUS * Math.sin(rad),
      y: SVG_CENTER - SVG_RADIUS * Math.cos(rad),
    };
  }

  onSegmentEnter(index: number): void {
    this.hoveredIndexChange.emit(index);
  }

  onSegmentLeave(): void {
    this.hoveredIndexChange.emit(null);
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
