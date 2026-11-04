import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PgUserRepository } from './repositories/pg-user.repository.js';
import { USER_REPOSITORY } from './repositories/user.repository.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    { provide: USER_REPOSITORY, useClass: PgUserRepository },
  ],
  exports: [UsersService, USER_REPOSITORY],
})
export class UsersModule {}
