import { Component, Input, OnChanges } from '@angular/core';
import { PhotoService } from '../../services/photo.service';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent implements OnChanges {
  @Input() email: string | null | undefined = null;
  @Input() name: string | null | undefined = '';
  @Input() size = 44;

  imgFailed = false;

  constructor(private readonly photoService: PhotoService) {}

  ngOnChanges(): void {
    this.imgFailed = false;
  }

  get photoUrl(): string | null {
    return this.photoService.photoUrl(this.email);
  }

  get initials(): string {
    const source = (this.name || this.email || '').trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  onError(): void {
    this.imgFailed = true;
  }
}
