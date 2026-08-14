import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nomination } from '../nominations/nomination.entity';
import { PersonPhoto } from './person-photo.entity';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [TypeOrmModule.forFeature([PersonPhoto, Nomination])],
  controllers: [PhotosController],
  providers: [PhotosService],
})
export class PhotosModule {}
