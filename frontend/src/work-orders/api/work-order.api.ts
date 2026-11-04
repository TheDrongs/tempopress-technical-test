import { http } from '../../api/http'
import type {
  PreparationInput,
  WorkOrder,
  WorkOrderCommand,
  WorkOrderDetail,
} from '../work-order.types'

export async function getWorkOrders(
  _actorId: string,
  signal?: AbortSignal,
): Promise<WorkOrder[]> {
  return (
    await http.get<WorkOrder[]>('/work-orders', {
      signal,
    })
  ).data
}

export async function getWorkOrder(
  id: string,
  _actorId: string,
  signal?: AbortSignal,
): Promise<WorkOrderDetail> {
  return (
    await http.get<WorkOrderDetail>(`/work-orders/${id}`, {
      signal,
    })
  ).data
}

export function preparationBody(input: PreparationInput) {
  const items = input.items.map((item) => ({
    name: item.name.trim(),
    qty: Number(item.qty),
    ...(item.file ? { photoKey: item.key } : {}),
  }))
  if (!input.items.some((item) => item.file)) {
    return { title: input.title.trim(), description: input.description, items }
  }
  const form = new FormData()
  form.set('title', input.title.trim())
  // Multipart fields are strings; empty string clears an optional description.
  form.set('description', input.description ?? '')
  form.set('items', JSON.stringify(items))
  for (const item of input.items) {
    if (item.file) form.set(`photos.${item.key}`, item.file, item.file.name)
  }
  return form
}

export async function executeCommand(
  command: WorkOrderCommand,
  _actorId: string,
): Promise<WorkOrder> {
  const config = {}
  switch (command.type) {
    case 'create':
      return (await http.post<WorkOrder>('/work-orders', command.input, config))
        .data
    case 'submit':
      return (
        await http.post<WorkOrder>(
          `/work-orders/${command.id}/submit`,
          command.spvId ? { spvId: command.spvId } : {},
          config,
        )
      ).data
    case 'assign':
      return (
        await http.post<WorkOrder>(
          `/work-orders/${command.id}/assign`,
          { mechanicId: command.mechanicId },
          config,
        )
      ).data
    case 'prepare': {
      const { input } = command
      if (!input.needsSpareparts) {
        return (
          await http.post<WorkOrder>(
            `/work-orders/${command.id}/update`,
            {
              title: input.title.trim(),
              description: input.description,
            },
            config,
          )
        ).data
      }
      return (
        await http.post<{ workOrder: WorkOrder }>(
          `/work-orders/${command.id}/request-sparepart`,
          preparationBody(input),
          config,
        )
      ).data.workOrder
    }
    case 'approve':
      return (
        await http.post<{ workOrder: WorkOrder }>(
          `/sparepart-requests/${command.requestId}/approve`,
          { approvalNote: command.approvalNote.trim() || null },
          config,
        )
      ).data.workOrder
    case 'start':
      return (
        await http.post<WorkOrder>(
          `/work-orders/${command.id}/start`,
          {},
          config,
        )
      ).data
    case 'complete':
      return (
        await http.post<WorkOrder>(
          `/work-orders/${command.id}/complete`,
          { endDate: command.endDate },
          config,
        )
      ).data
  }
}
