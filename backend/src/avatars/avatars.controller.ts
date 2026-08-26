import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AvatarsService } from './avatars.service';

@Controller('avatars')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  /**
   * Served from our own origin rather than redirecting to Google on purpose: the
   * winner card draws this image into a canvas with `crossOrigin = 'anonymous'`
   * before calling `toBlob()`, and staying same-origin keeps that export working
   * regardless of what CORS headers Google's CDN happens to return.
   *
   * Any signed-in user can read these, matching the rest of the public feed.
   */
  @Get(':name')
  async getAvatar(@Param('name') name: string, @Res() res: Response) {
    const avatar = await this.avatarsService.getAvatar(name);
    if (!avatar) {
      // The client turns this into its initials placeholder.
      throw new NotFoundException('No avatar found for that name');
    }

    res.setHeader('Content-Type', avatar.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(avatar.data);
  }
}
