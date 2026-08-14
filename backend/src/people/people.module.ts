import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NominationUpvote } from '../nominations/nomination-upvote.entity';
import { Nomination } from '../nominations/nomination.entity';
import { NominationsModule } from '../nominations/nominations.module';
import { RoundsModule } from '../rounds/rounds.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [TypeOrmModule.forFeature([Nomination, NominationUpvote]), NominationsModule, RoundsModule],
  controllers: [PeopleController],
  providers: [PeopleService],
})
export class PeopleModule {}
