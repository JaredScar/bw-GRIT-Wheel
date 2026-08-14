import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NominationUpvote } from '../nominations/nomination-upvote.entity';
import { Nomination } from '../nominations/nomination.entity';
import { Round } from '../rounds/round.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Nomination, NominationUpvote, Round])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
