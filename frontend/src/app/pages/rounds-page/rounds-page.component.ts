import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../../components/avatar/avatar.component';
import { Round, RoundStatus } from '../../models/round.model';
import { RoundService } from '../../services/round.service';
import { WinnerCardService } from '../../services/winner-card.service';

@Component({
  selector: 'app-rounds-page',
  standalone: true,
  imports: [DatePipe, RouterLink, AvatarComponent],
  templateUrl: './rounds-page.component.html',
  styleUrl: './rounds-page.component.scss',
})
export class RoundsPageComponent implements OnInit {
  readonly RoundStatus = RoundStatus;
  readonly rounds = signal<Round[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sharingCard = signal<string | null>(null);

  constructor(
    private readonly roundService: RoundService,
    private readonly winnerCardService: WinnerCardService,
  ) {}

  ngOnInit(): void {
    this.roundService.findAll().subscribe({
      next: (rounds) => {
        this.rounds.set(rounds);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load rounds right now.');
        this.loading.set(false);
      },
    });
  }

  async shareCard(round: Round): Promise<void> {
    if (!round.winnerNomineeName || !round.winnerNomineeEmail) return;
    this.sharingCard.set(round.id);
    try {
      await this.winnerCardService.shareOrDownload({
        name: round.winnerNomineeName,
        email: round.winnerNomineeEmail,
        roundTitle: round.title,
      });
    } finally {
      this.sharingCard.set(null);
    }
  }

  statusLabel(status: RoundStatus): string {
    switch (status) {
      case RoundStatus.OPEN:
        return 'Accepting nominations';
      case RoundStatus.COMPLETED:
        return 'Winner announced';
      case RoundStatus.CLOSED:
        return 'Closed';
      default:
        return status;
    }
  }
}
