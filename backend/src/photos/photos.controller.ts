import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AdminGuard } from '../auth/admin.guard';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { PhotosService } from './photos.service';

@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @UseGuards(AdminGuard)
  @Get('directory')
  directory() {
    return this.photosService.directory();
  }

  @UseGuards(AdminGuard)
  @Get()
  list() {
    return this.photosService.listSummaries();
  }

  @Get(':email')
  async getPhoto(@Param('email') email: string, @Res() res: Response) {
    const photo = await this.photosService.findByEmail(email);
    if (!photo) {
      throw new NotFoundException('No photo found for that email');
    }
    res.setHeader('Content-Type', photo.contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(photo.data);
  }

  @UseGuards(AdminGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadPhotoDto) {
    if (!dto.email) {
      throw new BadRequestException('email is required');
    }
    return this.photosService.upsert(dto.email, file);
  }

  @UseGuards(AdminGuard)
  @Delete(':email')
  async remove(@Param('email') email: string) {
    await this.photosService.remove(email);
    return { success: true };
  }
}
