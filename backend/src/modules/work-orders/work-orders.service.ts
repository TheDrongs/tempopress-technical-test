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
import { USER_REPOSITORY } from '../users/repositories/user.repository.js';
import type { UserRepository } from '../users/repositories/user.repository.js';
import { requireRole } from '../users/role-policy.js';
import { UserRole } from '../users/user.types.js';
import type { User } from '../users/user.types.js';
import { WORK_ORDER_REPOSITORY } from './repositories/work-order.repository.js';
import type {
  WorkOrderRepository,
  UpdateWorkOrderRecord,
} from './repositories/work-order.repository.js';
import { WorkOrderStatus } from './work-order.types.js';
import type {
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrder,
} from './work-order.types.js';
import { canReadWorkOrder } from './work-order.access.js';

@Injectable()
export class WorkOrdersService {
  constructor(
    @Inject(WORK_ORDER_REPOSITORY)
    private readonly workOrders: WorkOrderRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: TransactionManager,
  ) {}

  findAll(actor: User) {
    return this.workOrders.findAll(actor);
  }

  async findDetail(actor: User, id: string) {
    const order = await this.workOrders.findDetail(id);
    if (!order || !canReadWorkOrder(actor, order))
      throw new NotFoundException('Work Order was not found.');
    return order;
  }

  create(actor: User, input: CreateWorkOrderInput) {
    requireRole(actor, UserRole.ADMIN);
    return this.workOrders.create({
      title: input.title,
      description: input.description ?? null,
      status: WorkOrderStatus.DRAFT,
      createdBy: actor.id,
    });
  }

  submit(actor: User, id: string, spvId?: string) {
    requireRole(actor, UserRole.ADMIN);
    return this.transactions.withTransaction(async () => {
      await this.lockInStatus(id, WorkOrderStatus.DRAFT);
      const supervisors = spvId
        ? []
        : await this.users.findByRole(UserRole.SPV);
      if (!spvId && supervisors.length !== 1) {
        throw new BadRequestException(
          'Select the SPV who will receive this Work Order.',
        );
      }
      const supervisor = spvId
        ? await this.users.findById(spvId)
        : supervisors[0];
      if (!supervisor) throw new NotFoundException('SPV was not found.');
      if (supervisor.role !== UserRole.SPV)
        throw new BadRequestException('The recipient must have the SPV role.');
      return this.save(id, {
        status: WorkOrderStatus.SUBMITTED,
        assignedSpvId: supervisor.id,
      });
    });
  }

  assign(actor: User, id: string, mechanicId: string) {
    requireRole(actor, UserRole.SPV);
    return this.transactions.withTransaction(async () => {
      const order = await this.lockInStatus(id, WorkOrderStatus.SUBMITTED);
      if (order.assignedSpvId !== actor.id)
        throw new ForbiddenException(
          'Only the assigned SPV can assign this Work Order.',
        );
      const mechanic = await this.users.findById(mechanicId);
      if (!mechanic) throw new NotFoundException('Mechanic was not found.');
      if (mechanic.role !== UserRole.MECHANIC) {
        throw new BadRequestException(
          'Assigned user must have the MECHANIC role.',
        );
      }
      return this.save(id, {
        assignedMechanicId: mechanicId,
        status: WorkOrderStatus.ASSIGNED,
      });
    });
  }

  prepareWithoutSpareparts(
    actor: User,
    id: string,
    input: UpdateWorkOrderInput,
  ) {
    requireRole(actor, UserRole.ADMIN);
    return this.transactions.withTransaction(async () => {
      await this.lockInStatus(id, WorkOrderStatus.ASSIGNED);
      return this.save(id, { ...input, status: WorkOrderStatus.READY_TO_WORK });
    });
  }

  start(actor: User, id: string) {
    requireRole(actor, UserRole.MECHANIC);
    return this.transactions.withTransaction(async () => {
      const order = await this.lockInStatus(id, WorkOrderStatus.READY_TO_WORK);
      if (order.assignedMechanicId !== actor.id) {
        throw new ForbiddenException(
          'Only the assigned Mechanic can start this Work Order.',
        );
      }
      return this.save(id, {
        status: WorkOrderStatus.WORKING,
        startDate: new Date(),
      });
    });
  }

  complete(actor: User, id: string, endDate: Date) {
    requireRole(actor, UserRole.ADMIN);
    return this.transactions.withTransaction(async () => {
      const order = await this.lockInStatus(id, WorkOrderStatus.WORKING);
      if (
        !order.startDate ||
        !Number.isFinite(endDate.getTime()) ||
        endDate < order.startDate
      ) {
        throw new BadRequestException(
          'End date must be on or after the start date.',
        );
      }
      return this.save(id, { status: WorkOrderStatus.COMPLETED, endDate });
    });
  }

  private async lockInStatus(
    id: string,
    status: WorkOrderStatus,
  ): Promise<WorkOrder> {
    const order = await this.workOrders.findByIdForUpdate(id);
    if (!order) throw new NotFoundException('Work Order was not found.');
    if (order.status !== status) {
      throw new ConflictException(
        `This action requires Work Order status ${status}.`,
      );
    }
    return order;
  }

  private async save(id: string, input: UpdateWorkOrderRecord) {
    const order = await this.workOrders.update(id, input);
    if (!order) throw new NotFoundException('Work Order was not found.');
    return order;
  }
}
