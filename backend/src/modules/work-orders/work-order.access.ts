import type { User } from '../users/user.types.js';
import { UserRole } from '../users/user.types.js';
import type { WorkOrder } from './work-order.types.js';
import { WorkOrderStatus } from './work-order.types.js';

export function canReadWorkOrder(actor: User, order: WorkOrder): boolean {
  if (actor.role === UserRole.ADMIN) return true;
  if (order.status === WorkOrderStatus.DRAFT) return false;
  return actor.role === UserRole.SPV
    ? order.assignedSpvId === actor.id
    : order.assignedMechanicId === actor.id;
}
