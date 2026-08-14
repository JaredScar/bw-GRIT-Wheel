import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { MagicLinkToken } from './auth/magic-link-token.entity';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { NominationUpvote } from './nominations/nomination-upvote.entity';
import { Nomination } from './nominations/nomination.entity';
import { NominationsModule } from './nominations/nominations.module';
import { PeopleModule } from './people/people.module';
import { PersonPhoto } from './photos/person-photo.entity';
import { PhotosModule } from './photos/photos.module';
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
        entities: [Nomination, Round, PersonPhoto, NominationUpvote, User, MagicLinkToken],
        synchronize: true,
      }),
    }),
    AuthModule,
    NominationsModule,
    RoundsModule,
    PhotosModule,
    PeopleModule,
    AnalyticsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
