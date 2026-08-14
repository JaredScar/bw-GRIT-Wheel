import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoundsModule } from '../rounds/rounds.module';
import { NominationUpvote } from './nomination-upvote.entity';
import { Nomination } from './nomination.entity';
import { NominationsController } from './nominations.controller';
import { NominationsService } from './nominations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Nomination, NominationUpvote]), RoundsModule, NotificationsModule],
  controllers: [NominationsController],
  providers: [NominationsService],
  exports: [NominationsService],
})
export class NominationsModule {}
