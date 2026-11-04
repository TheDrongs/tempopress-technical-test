import { Info } from 'lucide-react'
import type { User } from '../../types/user.types'
import type { WorkOrder } from '../work-order.types'
import { summarizeWorkOrderTasks } from '../work-order.tasks'

export function WorkOrderTaskPanel({
  orders,
  actor,
}: {
  orders: WorkOrder[]
  actor: User
}) {
  const { tasks, total } = summarizeWorkOrderTasks(orders, actor)
  if (total === 0) return null

  return (
    <section
      role="status"
      aria-label="Ringkasan tugas Work Order"
      className="mb-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
    >
      <Info aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">
          Ada {total} WO yang memerlukan perhatian Anda.
        </p>
        <ul className="mt-1 divide-y divide-amber-200 text-xs leading-relaxed">
          {tasks.map(({ label, count }) => (
            <li key={label} className="py-1.5 first:pt-0 last:pb-0">
              {count} WO {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
