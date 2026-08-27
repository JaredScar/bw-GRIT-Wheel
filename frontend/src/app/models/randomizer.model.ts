import { EventEmitter } from '@angular/core';

export interface RandomizerEntry {
  label: string;
  weight?: number;
}

/** Shared contract so the admin page can drive whichever randomizer widget is active. */
export interface Randomizer {
  spinFinished: EventEmitter<number>;
  spinTo(index: number, extraSpins?: number): void;
  reset(): void;
}

export const RANDOMIZER_COLORS = [
  '#175ddc',
  '#1a1c21',
  '#0b826a',
  '#e07a1f',
  '#6c4de6',
  '#b7280c',
  '#0f9bd7',
  '#8a6300',
];

export function randomizerColor(index: number): string {
  return RANDOMIZER_COLORS[index % RANDOMIZER_COLORS.length];
}
