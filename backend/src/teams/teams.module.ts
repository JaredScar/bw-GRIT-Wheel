import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectoryPerson } from '../directory/directory-person.entity';
import { DirectoryModule } from '../directory/directory.module';
import { Team } from './team.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [TypeOrmModule.forFeature([Team, DirectoryPerson]), DirectoryModule],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
