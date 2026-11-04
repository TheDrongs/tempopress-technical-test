import type { User } from '../types/user.types'

export type WorkOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'WAITING_SPAREPART_APPROVAL'
  | 'READY_TO_WORK'
  | 'WORKING'
  | 'COMPLETED'

export interface WorkOrder {
  id: string
  title: string
  description: string | null
  status: WorkOrderStatus
  createdBy: string
  assignedSpvId: string | null
  assignedMechanicId: string | null
  startDate: string | null
  endDate: string | null
  createdAt: string
  updatedAt: string
}

export interface SparepartItem {
  id: string
  sparepartRequestId: string
  name: string
  qty: number
  imagePath: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface SparepartRequest {
  id: string
  workOrderId: string
  status: 'PENDING' | 'APPROVED'
  requestedBy: string
  approvedBy: string | null
  approvalNote: string | null
  requestedByUser: User
  approvedByUser: User | null
  items: SparepartItem[]
  createdAt: string
  updatedAt: string
}

export interface WorkOrderDetail extends WorkOrder {
  createdByUser: User
  assignedMechanic: User | null
  assignedSpv: User | null
  sparepartRequests: SparepartRequest[]
}

export interface WorkOrderInput {
  title: string
  description: string | null
}

// Files stay in the local form draft, never in a persisted store.
export interface SparepartDraft {
  key: string
  name: string
  qty: string
  file: File | null
  previewUrl?: string
}

export interface PreparationInput extends WorkOrderInput {
  needsSpareparts: boolean
  items: SparepartDraft[]
}

export type WorkOrderCommand =
  | { type: 'create'; input: WorkOrderInput }
  | { type: 'submit'; id: string; spvId?: string }
  | { type: 'assign'; id: string; mechanicId: string }
  | { type: 'prepare'; id: string; input: PreparationInput }
  | { type: 'approve'; requestId: string; approvalNote: string }
  | { type: 'start'; id: string }
  | { type: 'complete'; id: string; endDate: string }
