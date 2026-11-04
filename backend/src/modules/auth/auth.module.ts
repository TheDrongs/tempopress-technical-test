import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { AUTH_REPOSITORY } from './auth.repository.js';
import { PgAuthRepository } from './pg-auth.repository.js';
@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_REPOSITORY, useClass: PgAuthRepository },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
