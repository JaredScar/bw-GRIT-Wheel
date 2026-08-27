import { Component, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CardFlipComponent } from '../card-flip/card-flip.component';
import { EliminationFlashComponent } from '../elimination-flash/elimination-flash.component';
import { LotteryBallComponent } from '../lottery-ball/lottery-ball.component';
import { SlotMachineComponent } from '../slot-machine/slot-machine.component';
import { WheelComponent } from '../wheel/wheel.component';
import {
  Randomizer,
  RandomizerEntry,
  RandomizerMode,
  randomizerColor,
} from '../../models/randomizer.model';

/**
 * Wraps the style toggle, whichever randomizer widget is currently selected, and the
 * "eligible nominees" panel into one reusable unit implementing the same `Randomizer`
 * contract as its children — callers just call `spinTo`/`reset` without caring which
 * style is active. Used both for the real spin-a-round flow and the preview sandbox.
 */
@Component({
  selector: 'app-randomizer-stage',
  standalone: true,
  imports: [WheelComponent, SlotMachineComponent, EliminationFlashComponent, CardFlipComponent, LotteryBallComponent],
  templateUrl: './randomizer-stage.component.html',
  styleUrl: './randomizer-stage.component.scss',
})
export class RandomizerStageComponent implements Randomizer {
  @Input() entries: RandomizerEntry[] = [];
  @Output() spinFinished = new EventEmitter<number>();

  @ViewChild('wheelRef') private wheel?: WheelComponent;
  @ViewChild('slotRef') private slotMachine?: SlotMachineComponent;
  @ViewChild('eliminationRef') private eliminationFlash?: EliminationFlashComponent;
  @ViewChild('cardFlipRef') private cardFlip?: CardFlipComponent;
  @ViewChild('lotteryRef') private lotteryBall?: LotteryBallComponent;

  readonly randomizerColor = randomizerColor;
  mode: RandomizerMode = 'wheel';
  hoveredSegment: number | null = null;
  spinning = false;

  private get active(): Randomizer | undefined {
    switch (this.mode) {
      case 'wheel':
        return this.wheel;
      case 'slot':
        return this.slotMachine;
      case 'elimination':
        return this.eliminationFlash;
      case 'cardflip':
        return this.cardFlip;
      case 'lottery':
        return this.lotteryBall;
    }
  }

  setMode(mode: RandomizerMode): void {
    if (this.spinning) return;
    this.mode = mode;
    this.hoveredSegment = null;
  }

  onLegendHover(index: number | null): void {
    if (this.mode === 'wheel') {
      this.hoveredSegment = index;
    }
  }

  onChildSpinFinished(index: number): void {
    this.spinning = false;
    this.spinFinished.emit(index);
  }

  spinTo(index: number, extraSpins?: number): void {
    this.spinning = true;
    this.active?.spinTo(index, extraSpins);
  }

  reset(): void {
    this.wheel?.reset();
    this.slotMachine?.reset();
    this.eliminationFlash?.reset();
    this.cardFlip?.reset();
    this.lotteryBall?.reset();
    this.spinning = false;
    this.hoveredSegment = null;
  }
}
