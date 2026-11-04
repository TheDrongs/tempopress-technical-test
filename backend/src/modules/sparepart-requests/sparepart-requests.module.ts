import { Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { DatabaseModule } from '../../database/database.module.js';
import { UsersModule } from '../users/users.module.js';
import { WorkOrdersModule } from '../work-orders/work-orders.module.js';
import { PgSparepartRequestRepository } from './repositories/pg-sparepart-request.repository.js';
import { SPAREPART_REQUEST_REPOSITORY } from './repositories/sparepart-request.repository.js';
import { SparepartRequestsController } from './sparepart-requests.controller.js';
import { SparepartRequestsService } from './sparepart-requests.service.js';
import { UPLOADS_DIRECTORY } from './photos/photo.constants.js';
import { SparepartPhotoStorage } from './photos/sparepart-photo.storage.js';

@Module({
  imports: [DatabaseModule, UsersModule, WorkOrdersModule],
  controllers: [SparepartRequestsController],
  providers: [
    SparepartRequestsService,
    SparepartPhotoStorage,
    {
      provide: UPLOADS_DIRECTORY,
      useFactory: () => resolve(process.env.UPLOADS_DIRECTORY ?? 'uploads'),
    },
    {
      provide: SPAREPART_REQUEST_REPOSITORY,
      useClass: PgSparepartRequestRepository,
    },
  ],
  exports: [SparepartRequestsService, SPAREPART_REQUEST_REPOSITORY],
})
export class SparepartRequestsModule {}
