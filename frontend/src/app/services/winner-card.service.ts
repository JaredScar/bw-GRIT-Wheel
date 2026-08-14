import { Injectable } from '@angular/core';
import { PhotoService } from './photo.service';

export interface WinnerCardParams {
  name: string;
  email: string;
  roundTitle: string;
}

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const AVATAR_SIZE = 220;
const AVATAR_CENTER_Y = 230;
const INITIALS_COLORS = ['#175ddc', '#e07a1f', '#6c4de6', '#0b826a', '#b7280c', '#0f9bd7'];

@Injectable({ providedIn: 'root' })
export class WinnerCardService {
  constructor(private readonly photoService: PhotoService) {}

  /** Tries the native share sheet first (great on mobile/Slack apps); falls back to a direct download. */
  async shareOrDownload(params: WinnerCardParams): Promise<'shared' | 'downloaded'> {
    const blob = await this.render(params);
    const shared = await this.tryShare(blob, params);
    if (shared) return 'shared';
    this.download(blob, params.name);
    return 'downloaded';
  }

  private async render(params: WinnerCardParams): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser');

    const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    gradient.addColorStop(0, '#14181f');
    gradient.addColorStop(1, '#175ddc');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px Arial, sans-serif';
    ctx.fillText('Bitwarden', 60, 70);
    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('GRIT Award', 60, 100);

    const avatarX = CARD_WIDTH / 2;
    const image = await this.tryLoadImage(this.photoService.photoUrl(params.email));

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, AVATAR_CENTER_Y, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (image) {
      this.drawImageCover(
        ctx,
        image,
        avatarX - AVATAR_SIZE / 2,
        AVATAR_CENTER_Y - AVATAR_SIZE / 2,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
    } else {
      ctx.fillStyle = this.colorForName(params.name);
      ctx.fillRect(
        avatarX - AVATAR_SIZE / 2,
        AVATAR_CENTER_Y - AVATAR_SIZE / 2,
        AVATAR_SIZE,
        AVATAR_SIZE,
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 90px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.initials(params.name), avatarX, AVATAR_CENTER_Y);
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avatarX, AVATAR_CENTER_Y, AVATAR_SIZE / 2 + 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffb020';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 56px Arial, sans-serif';
    ctx.fillText(params.name, CARD_WIDTH / 2, 420);

    ctx.font = '600 28px Arial, sans-serif';
    ctx.fillStyle = '#ffd479';
    ctx.fillText('🏆 GRIT Award Winner', CARD_WIDTH / 2, 470);

    ctx.font = '400 24px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(params.roundTitle, CARD_WIDTH / 2, 510);

    ctx.font = '400 20px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('$100 to the Bitwarden Swag Store 🎉', CARD_WIDTH / 2, 570);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to render winner card image'));
      }, 'image/png');
    });
  }

  private async tryShare(blob: Blob, params: WinnerCardParams): Promise<boolean> {
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (!nav.share || !nav.canShare) return false;

    const file = new File([blob], `grit-winner-${this.slug(params.name)}.png`, { type: 'image/png' });
    if (!nav.canShare({ files: [file] })) return false;

    try {
      await nav.share({
        files: [file],
        title: 'GRIT Award Winner',
        text: `${params.name} just won the Bitwarden GRIT Award for ${params.roundTitle}!`,
      });
      return true;
    } catch {
      return false;
    }
  }

  private download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grit-winner-${this.slug(name)}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async tryLoadImage(url: string | null): Promise<HTMLImageElement | null> {
    if (!url) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  private drawImageCover(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (imgRatio > boxRatio) {
      sw = img.height * boxRatio;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / boxRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  private colorForName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return INITIALS_COLORS[Math.abs(hash) % INITIALS_COLORS.length];
  }

  private slug(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
  }
}
