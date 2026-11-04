import type { UserSummary } from '../users/user.types.js';
import type { UpdateWorkOrderInput } from '../work-orders/work-order.types.js';

export enum SparepartRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
}

export interface CreateSparepartRequestInput extends UpdateWorkOrderInput {
  items: { name: string; qty: number; photoKey?: string }[];
}

export interface ApproveSparepartRequestInput {
  approvalNote?: string | null;
}

export interface SparepartRequestDetail extends SparepartRequest {
  requestedByUser: UserSummary;
  approvedByUser: UserSummary | null;
}

export interface SparepartItem {
  id: string;
  sparepartRequestId: string;
  name: string;
  qty: number;
  imagePath: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SparepartRequest {
  id: string;
  workOrderId: string;
  status: SparepartRequestStatus;
  requestedBy: string;
  approvedBy: string | null;
  approvalNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: SparepartItem[];
}
