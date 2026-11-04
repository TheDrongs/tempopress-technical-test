import type { User, UserRole } from '../types/user.types'
import type { WorkOrder, WorkOrderStatus } from './work-order.types'

const tasksByRole: Record<
  UserRole,
  { status: WorkOrderStatus; label: string }[]
> = {
  ADMIN: [
    { status: 'DRAFT', label: "masih berstatus 'Draft'" },
    { status: 'ASSIGNED', label: 'menunggu persiapan' },
    { status: 'WORKING', label: 'menunggu penyelesaian' },
  ],
  SPV: [
    { status: 'SUBMITTED', label: 'menunggu penugasan mechanic' },
    {
      status: 'WAITING_SPAREPART_APPROVAL',
      label: 'menunggu persetujuan sparepart',
    },
  ],
  MECHANIC: [
    { status: 'READY_TO_WORK', label: 'siap dikerjakan' },
    { status: 'WORKING', label: 'sedang dikerjakan' },
  ],
}

export function summarizeWorkOrderTasks(orders: WorkOrder[], actor: User) {
  const assignedOrders = orders.filter(
    (order) =>
      actor.role === 'ADMIN' ||
      (actor.role === 'SPV'
        ? order.assignedSpvId === actor.id
        : order.assignedMechanicId === actor.id),
  )
  const tasks = tasksByRole[actor.role]
    .map(({ status, label }) => ({
      label,
      count: assignedOrders.filter((order) => order.status === status).length,
    }))
    .filter(({ count }) => count > 0)

  return { tasks, total: tasks.reduce((sum, task) => sum + task.count, 0) }
}
