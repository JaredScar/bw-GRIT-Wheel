import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AvatarsController } from './avatars.controller';
import { AvatarsService } from './avatars.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AvatarsController],
  providers: [AvatarsService],
})
export class AvatarsModule {}
