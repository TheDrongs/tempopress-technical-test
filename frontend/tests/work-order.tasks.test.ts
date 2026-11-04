import { describe, expect, it } from 'vitest'
import { summarizeWorkOrderTasks } from '../src/work-orders/work-order.tasks'
import type {
  WorkOrder,
  WorkOrderStatus,
} from '../src/work-orders/work-order.types'
import type { User } from '../src/types/user.types'

const admin: User = { id: 'admin', name: 'Admin', role: 'ADMIN' }
const spv: User = { id: 'spv', name: 'SPV', role: 'SPV' }
const mechanic: User = { id: 'mechanic', name: 'Mechanic', role: 'MECHANIC' }
function order(
  status: WorkOrderStatus,
  assignedSpvId = spv.id,
  assignedMechanicId = mechanic.id,
): WorkOrder {
  return {
    id: crypto.randomUUID(),
    title: status,
    description: null,
    status,
    createdBy: admin.id,
    assignedSpvId,
    assignedMechanicId,
    startDate: null,
    endDate: null,
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  }
}
const statuses: WorkOrderStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'ASSIGNED',
  'WAITING_SPAREPART_APPROVAL',
  'READY_TO_WORK',
  'WORKING',
  'COMPLETED',
]

describe('role task summary', () => {
  it('counts Admin tasks across WO without counting stages waiting for other roles', () => {
    const summary = summarizeWorkOrderTasks(
      statuses.map((status) => order(status)),
      admin,
    )
    expect(summary.total).toBe(3)
    expect(summary.tasks.map((task) => task.label)).toEqual([
      "masih berstatus 'Draft'",
      'menunggu persiapan',
      'menunggu penyelesaian',
    ])
  })

  it('counts assigned SPV work orders once, separating assignment and sparepart approval', () => {
    const orders = [
      order('SUBMITTED'),
      order('SUBMITTED'),
      order('WAITING_SPAREPART_APPROVAL'),
      order('SUBMITTED', 'other-spv'),
      order('WAITING_SPAREPART_APPROVAL', 'other-spv'),
      order('COMPLETED'),
      order('DRAFT'),
      order('ASSIGNED'),
    ]
    expect(summarizeWorkOrderTasks(orders, spv)).toEqual({
      total: 3,
      tasks: [
        { label: 'menunggu penugasan mechanic', count: 2 },
        { label: 'menunggu persetujuan sparepart', count: 1 },
      ],
    })
  })

  it('counts only the selected mechanic ready and ongoing assignments', () => {
    const orders = [
      ...statuses.map((status) => order(status)),
      order('READY_TO_WORK', spv.id, 'other-mechanic'),
      order('WORKING', spv.id, 'other-mechanic'),
    ]
    expect(summarizeWorkOrderTasks(orders, mechanic)).toEqual({
      total: 2,
      tasks: [
        { label: 'siap dikerjakan', count: 1 },
        { label: 'sedang dikerjakan', count: 1 },
      ],
    })
  })

  it('returns no tasks for empty, completed, or waiting-only lists', () => {
    expect(summarizeWorkOrderTasks([], admin).total).toBe(0)
    expect(summarizeWorkOrderTasks([order('COMPLETED')], spv).total).toBe(0)
    expect(
      summarizeWorkOrderTasks([order('WAITING_SPAREPART_APPROVAL')], mechanic)
        .total,
    ).toBe(0)
  })
})
