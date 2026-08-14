import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';

const CONFETTI_COLORS = ['#175ddc', '#e07a1f', '#6c4de6', '#0b826a', '#b7280c'];

@Injectable({ providedIn: 'root' })
export class CelebrationService {
  celebrate(): void {
    this.fireConfetti();
    this.playChime();
  }

  private fireConfetti(): void {
    confetti({
      particleCount: 130,
      spread: 90,
      startVelocity: 45,
      origin: { y: 0.55 },
      colors: CONFETTI_COLORS,
    });

    const end = Date.now() + 1000;
    const burstFromSides = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: CONFETTI_COLORS,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: CONFETTI_COLORS,
      });

      if (Date.now() < end) {
        requestAnimationFrame(burstFromSides);
      }
    };
    burstFromSides();
  }

  private playChime(): void {
    try {
      const AudioContextCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextCtor();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];

      notes.forEach((frequency, i) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;

        const start = now + i * 0.13;
        const end = start + 0.3;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(end + 0.05);
      });

      setTimeout(() => ctx.close(), (notes.length * 0.13 + 0.5) * 1000);
    } catch {
      // Sound is a nice-to-have; ignore if the browser blocks/lacks Web Audio support.
    }
  }
}
