import {
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  Send,
  UserRoundCheck,
  Wrench,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WorkOrderStatus } from '../work-order.types'

const statusLabels: Record<WorkOrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Menunggu Approval SPV',
  ASSIGNED: 'Ditugaskan',
  WAITING_SPAREPART_APPROVAL: 'Menunggu persetujuan',
  READY_TO_WORK: 'Siap dikerjakan',
  WORKING: 'Dikerjakan',
  COMPLETED: 'Selesai',
}

const statuses = {
  DRAFT: {
    icon: CircleDashed,
    color: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
  SUBMITTED: {
    icon: Send,
    color: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  ASSIGNED: {
    icon: UserRoundCheck,
    color: 'bg-orange-50 text-orange-800 ring-orange-200',
  },
  WAITING_SPAREPART_APPROVAL: {
    icon: Clock3,
    color: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  READY_TO_WORK: {
    icon: ClipboardCheck,
    color: 'bg-teal-50 text-teal-800 ring-teal-200',
  },
  WORKING: { icon: Wrench, color: 'bg-sky-50 text-sky-800 ring-sky-200' },
  COMPLETED: {
    icon: CheckCircle2,
    color: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  },
}

export function StatusBadge({
  status,
  showLabel = false,
  className,
}: {
  status: WorkOrderStatus
  showLabel?: boolean
  className?: string
}) {
  const { icon: Icon, color } = statuses[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        color,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {showLabel ? `Status : ${statusLabels[status]}` : statusLabels[status]}
    </span>
  )
}
