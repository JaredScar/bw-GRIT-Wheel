import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');

    if (!host || !port) {
      this.transporter = null;
      return;
    }

    const user = this.configService.get<string>('SMTP_USER');
    const password = this.configService.get<string>('SMTP_PASSWORD');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async sendMagicLink(email: string, link: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM', '"Bitwarden GRIT Award" <no-reply@bitwarden.com>');
    const subject = 'Your GRIT Award sign-in link';
    const text = `Click this link to sign in to the Bitwarden GRIT Award app:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once. If you didn't request this, you can ignore this email.`;
    const html = `
      <p>Click below to sign in to the Bitwarden GRIT Award app:</p>
      <p><a href="${link}">${link}</a></p>
      <p>This link expires in 15 minutes and can only be used once. If you didn't request this, you can ignore this email.</p>
    `;

    if (!this.transporter) {
      this.logger.warn(
        `SMTP is not configured (set SMTP_HOST/SMTP_PORT) — logging the magic link for ${email} instead of emailing it:`,
      );
      this.logger.warn(link);
      return;
    }

    try {
      await this.transporter.sendMail({ from, to: email, subject, text, html });
    } catch (error) {
      this.logger.error(`Failed to send magic link email to ${email}: ${(error as Error).message}`);
      this.logger.warn(`Magic link for ${email} (email delivery failed, use this instead): ${link}`);
    }
  }
}
