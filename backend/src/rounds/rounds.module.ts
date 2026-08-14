import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nomination } from '../nominations/nomination.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Round } from './round.entity';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

@Module({
  imports: [TypeOrmModule.forFeature([Round, Nomination]), NotificationsModule],
  controllers: [RoundsController],
  providers: [RoundsService],
  exports: [RoundsService],
})
export class RoundsModule {}
