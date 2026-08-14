import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface WheelSegment {
  label: string;
  weight?: number;
}

@Component({
  selector: 'app-wheel',
  standalone: true,
  templateUrl: './wheel.component.html',
  styleUrl: './wheel.component.scss',
})
export class WheelComponent {
  @Input() segments: WheelSegment[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  rotation = 0;
  spinning = false;

  private readonly colors = [
    '#175ddc',
    '#1a1c21',
    '#0b826a',
    '#e07a1f',
    '#6c4de6',
    '#b7280c',
    '#0f9bd7',
    '#8a6300',
  ];

  segmentColor(index: number): string {
    return this.colors[index % this.colors.length];
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

  labelTransform(index: number): string {
    return `rotate(${this.segmentMidAngle(index)}deg)`;
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
