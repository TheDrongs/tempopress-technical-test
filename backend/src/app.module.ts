import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module.js';
import { SparepartRequestsModule } from './modules/sparepart-requests/sparepart-requests.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    WorkOrdersModule,
    SparepartRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
