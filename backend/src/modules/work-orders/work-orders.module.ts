import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersModule } from '../users/users.module.js';
import { PgWorkOrderRepository } from './repositories/pg-work-order.repository.js';
import { WORK_ORDER_REPOSITORY } from './repositories/work-order.repository.js';
import { WorkOrdersController } from './work-orders.controller.js';
import { WorkOrdersService } from './work-orders.service.js';

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    { provide: WORK_ORDER_REPOSITORY, useClass: PgWorkOrderRepository },
  ],
  exports: [WorkOrdersService, WORK_ORDER_REPOSITORY],
})
export class WorkOrdersModule {}
