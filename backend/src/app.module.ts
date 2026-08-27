import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AvatarsModule } from './avatars/avatars.module';
import { DirectoryPerson } from './directory/directory-person.entity';
import { DirectoryModule } from './directory/directory.module';
import { NominationUpvote } from './nominations/nomination-upvote.entity';
import { Nomination } from './nominations/nomination.entity';
import { NominationsModule } from './nominations/nominations.module';
import { PeopleModule } from './people/people.module';
import { Round } from './rounds/round.entity';
import { RoundsModule } from './rounds/rounds.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'grit_wheel'),
        entities: [Nomination, Round, NominationUpvote, User, DirectoryPerson],
        synchronize: true,
      }),
    }),
    AuthModule,
    NominationsModule,
    RoundsModule,
    AvatarsModule,
    PeopleModule,
    AnalyticsModule,
    DirectoryModule,
  ],
  // Order matters: Nest runs global guards in registration order, so JwtAuthGuard
  // populates request.user before RolesGuard reads the roles off it.
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
