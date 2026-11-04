import type { UserSummary } from '../users/user.types.js';
import type { SparepartRequestDetail } from '../sparepart-requests/sparepart-request.types.js';

export enum WorkOrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ASSIGNED = 'ASSIGNED',
  WAITING_SPAREPART_APPROVAL = 'WAITING_SPAREPART_APPROVAL',
  READY_TO_WORK = 'READY_TO_WORK',
  WORKING = 'WORKING',
  COMPLETED = 'COMPLETED',
}

export interface CreateWorkOrderInput {
  title: string;
  description?: string | null;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string | null;
}

export interface WorkOrderDetail extends WorkOrder {
  createdByUser: UserSummary;
  assignedMechanic: UserSummary | null;
  assignedSpv: UserSummary | null;
  sparepartRequests: SparepartRequestDetail[];
}

export interface WorkOrder {
  id: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  createdBy: string;
  assignedSpvId: string | null;
  assignedMechanicId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
