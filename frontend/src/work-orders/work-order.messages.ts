import type { WorkOrderCommand } from './work-order.types'

export function successMessage(command: WorkOrderCommand): string {
  switch (command.type) {
    case 'create':
      return 'Sukses membuat Draft WO'
    case 'submit':
      return 'Sukses mengirim WO ke SPV'
    case 'assign':
      return 'Sukses menugaskan Mechanic'
    case 'prepare':
      return command.input.needsSpareparts
        ? 'Sukses mengajukan sparepart'
        : 'Sukses menyimpan persiapan WO'
    case 'approve':
      return 'Sukses menyetujui pengajuan sparepart'
    case 'start':
      return 'Sukses memulai pekerjaan'
    case 'complete':
      return 'Sukses menyelesaikan Work Order'
  }
}
