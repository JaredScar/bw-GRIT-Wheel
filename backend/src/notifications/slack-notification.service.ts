import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GRIT_CATEGORY_LABELS, GritCategory } from '../common/grit-category.enum';

@Injectable()
export class SlackNotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  private get webhookUrl(): string | undefined {
    return this.configService.get<string>('SLACK_WEBHOOK_URL');
  }

  async notifyNewNomination(params: {
    nomineeName: string;
    gritCategory: GritCategory;
    reason: string;
    isAnonymous: boolean;
    nominatorName: string | null;
  }): Promise<void> {
    const nominator = params.isAnonymous || !params.nominatorName ? 'Someone' : params.nominatorName;
    const categoryLabel = GRIT_CATEGORY_LABELS[params.gritCategory] ?? params.gritCategory;
    const reasonSnippet =
      params.reason.length > 300 ? `${params.reason.slice(0, 300)}...` : params.reason;

    await this.send(
      `New GRIT nomination for ${params.nomineeName} (${categoryLabel})`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🎉 *New GRIT nomination!*\n${nominator} nominated *${params.nomineeName}* for *${categoryLabel}*:\n>${reasonSnippet}`,
          },
        },
      ],
    );
  }

  async notifyRoundOpened(title: string): Promise<void> {
    await this.send(`A new GRIT round is open: ${title}`, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📣 *A new GRIT round is open: ${title}*\nSubmit your nominations!`,
        },
      },
    ]);
  }

  async notifyWinner(params: { roundTitle: string; winnerName: string }): Promise<void> {
    await this.send(`${params.winnerName} won the ${params.roundTitle} GRIT Award!`, [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🏆 *The wheel has spoken!*\nCongrats to *${params.winnerName}*, winner of the *${params.roundTitle}* GRIT Award! 🎉`,
        },
      },
    ]);
  }

  private async send(fallbackText: string, blocks: unknown[]): Promise<void> {
    const url = this.webhookUrl;
    if (!url) return;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fallbackText, blocks }),
      });
      if (!response.ok) {
        this.logger.warn(`Slack webhook responded with status ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to send Slack notification: ${(error as Error).message}`);
    }
  }
}
