import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TRANSACTION_MANAGER } from '../../database/transaction-manager.js';
import type { TransactionManager } from '../../database/transaction-manager.js';
import { requireRole } from '../users/role-policy.js';
import { UserRole } from '../users/user.types.js';
import type { User } from '../users/user.types.js';
import { WORK_ORDER_REPOSITORY } from '../work-orders/repositories/work-order.repository.js';
import type { WorkOrderRepository } from '../work-orders/repositories/work-order.repository.js';
import { WorkOrderStatus } from '../work-orders/work-order.types.js';
import { canReadWorkOrder } from '../work-orders/work-order.access.js';
import { SPAREPART_REQUEST_REPOSITORY } from './repositories/sparepart-request.repository.js';
import type { SparepartRequestRepository } from './repositories/sparepart-request.repository.js';
import { SparepartRequestStatus } from './sparepart-request.types.js';
import { SparepartPhotoStorage } from './photos/sparepart-photo.storage.js';
import type { PreparedPhoto } from './photos/sparepart-photo.storage.js';
import type {
  ApproveSparepartRequestInput,
  CreateSparepartRequestInput,
} from './sparepart-request.types.js';

@Injectable()
export class SparepartRequestsService {
  constructor(
    @Inject(SPAREPART_REQUEST_REPOSITORY)
    private readonly requests: SparepartRequestRepository,
    @Inject(WORK_ORDER_REPOSITORY)
    private readonly workOrders: WorkOrderRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
    private readonly photos: SparepartPhotoStorage,
  ) {}

  async create(
    actor: User,
    workOrderId: string,
    input: CreateSparepartRequestInput,
    files: Express.Multer.File[] = [],
  ) {
    requireRole(actor, UserRole.ADMIN);
    if (input.items.length === 0)
      throw new BadRequestException('At least one sparepart item is required.');
    const prepared = await this.preparePhotos(input, files);
    const stored: string[] = [];
    try {
      return await this.transactions.withTransaction(async () => {
        const existing = await this.workOrders.findByIdForUpdate(workOrderId);
        if (!existing) throw new NotFoundException('Work Order was not found.');
        if (existing.status !== WorkOrderStatus.ASSIGNED) {
          throw new ConflictException(
            'Spareparts can only be requested during ASSIGNED preparation.',
          );
        }
        for (const photo of prepared.values()) {
          await this.photos.save(photo);
          stored.push(photo.imagePath);
        }
        const workOrder = await this.workOrders.update(workOrderId, {
          title: input.title,
          description: input.description,
          status: WorkOrderStatus.WAITING_SPAREPART_APPROVAL,
        });
        if (!workOrder)
          throw new NotFoundException('Work Order was not found.');
        const sparepartRequest = await this.requests.create({
          workOrderId,
          status: SparepartRequestStatus.PENDING,
          requestedBy: actor.id,
          items: input.items.map((item) => ({
            name: item.name,
            qty: item.qty,
            imagePath: item.photoKey
              ? prepared.get(item.photoKey)!.imagePath
              : null,
          })),
        });
        return { workOrder, sparepartRequest };
      });
    } catch (error) {
      const cleanup = await Promise.allSettled(
        stored.map((path) => this.photos.remove(path)),
      );
      const failures = cleanup.filter((result) => result.status === 'rejected');
      if (failures.length) {
        throw new AggregateError(
          [error, ...failures.map((failure) => failure.reason as unknown)],
          'Sparepart request failed and upload cleanup was incomplete.',
        );
      }
      throw error;
    }
  }

  async readPhoto(actor: User, itemId: string) {
    const item = await this.requests.findItemImage(itemId);
    if (!item?.imagePath)
      throw new NotFoundException('Sparepart photo was not found.');
    const order = await this.workOrders.findById(item.workOrderId);
    if (!order || !canReadWorkOrder(actor, order))
      throw new NotFoundException('Sparepart photo was not found.');
    return this.photos.read(item.imagePath);
  }

  private async preparePhotos(
    input: CreateSparepartRequestInput,
    files: Express.Multer.File[],
  ): Promise<Map<string, PreparedPhoto>> {
    const expected = input.items.flatMap((item) =>
      item.photoKey === undefined ? [] : [item.photoKey],
    );
    if (new Set(expected).size !== expected.length) {
      throw new BadRequestException(
        'Each photoKey must belong to one item only.',
      );
    }
    const uploaded = new Map<string, Express.Multer.File>();
    for (const file of files) {
      const key = file.fieldname.startsWith('photos.')
        ? file.fieldname.slice('photos.'.length)
        : '';
      if (!expected.includes(key) || uploaded.has(key)) {
        throw new BadRequestException(
          'Each photo must match exactly one item photoKey.',
        );
      }
      uploaded.set(key, file);
    }
    if (expected.some((key) => !uploaded.has(key))) {
      throw new BadRequestException(
        'A photoKey is missing its matching photo file.',
      );
    }
    const prepared = new Map<string, PreparedPhoto>();
    for (const [key, file] of uploaded) {
      prepared.set(key, await this.photos.prepare(file));
    }
    return prepared;
  }

  approve(actor: User, id: string, input: ApproveSparepartRequestInput) {
    requireRole(actor, UserRole.SPV);
    return this.transactions.withTransaction(async () => {
      const initial = await this.requests.findById(id);
      if (!initial)
        throw new NotFoundException('Sparepart Request was not found.');
      // Always lock the WO first. All progress and approval operations use this ordering.
      const workOrder = await this.workOrders.findByIdForUpdate(
        initial.workOrderId,
      );
      if (!workOrder) throw new NotFoundException('Work Order was not found.');
      if (workOrder.assignedSpvId !== actor.id)
        throw new ForbiddenException(
          'Only the assigned SPV can approve spareparts for this Work Order.',
        );
      const current = await this.requests.findById(id);
      if (!current)
        throw new NotFoundException('Sparepart Request was not found.');
      if (
        current.status !== SparepartRequestStatus.PENDING ||
        workOrder.status !== WorkOrderStatus.WAITING_SPAREPART_APPROVAL
      ) {
        throw new ConflictException('This request is not awaiting approval.');
      }
      const sparepartRequest = await this.requests.update(id, {
        status: SparepartRequestStatus.APPROVED,
        approvedBy: actor.id,
        approvalNote: input.approvalNote ?? null,
      });
      if (!sparepartRequest)
        throw new NotFoundException('Sparepart Request was not found.');
      const updatedOrder =
        (await this.requests.countPending(workOrder.id)) === 0
          ? await this.workOrders.update(workOrder.id, {
              status: WorkOrderStatus.READY_TO_WORK,
            })
          : workOrder;
      if (!updatedOrder)
        throw new NotFoundException('Work Order was not found.');
      return { workOrder: updatedOrder, sparepartRequest };
    });
  }
}
