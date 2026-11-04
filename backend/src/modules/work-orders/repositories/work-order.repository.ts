import type { WorkOrder, WorkOrderDetail } from '../work-order.types.js';
import type { User } from '../../users/user.types.js';

export const WORK_ORDER_REPOSITORY = Symbol('WORK_ORDER_REPOSITORY');

export type CreateWorkOrderRecord = Pick<
  WorkOrder,
  'title' | 'description' | 'status' | 'createdBy'
>;

export type UpdateWorkOrderRecord = Partial<
  Pick<
    WorkOrder,
    | 'title'
    | 'description'
    | 'status'
    | 'assignedMechanicId'
    | 'assignedSpvId'
    | 'startDate'
    | 'endDate'
  >
>;

export interface WorkOrderRepository {
  findAll(actor: User): Promise<WorkOrder[]>;
  findById(id: string): Promise<WorkOrder | null>;
  findByIdForUpdate(id: string): Promise<WorkOrder | null>;
  findDetail(id: string): Promise<WorkOrderDetail | null>;
  create(input: CreateWorkOrderRecord): Promise<WorkOrder>;
  update(id: string, input: UpdateWorkOrderRecord): Promise<WorkOrder | null>;
}
