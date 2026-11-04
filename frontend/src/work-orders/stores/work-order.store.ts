import { create } from 'zustand'
import { apiError } from '../../api/http'
import {
  executeCommand,
  getWorkOrder,
  getWorkOrders,
} from '../api/work-order.api'
import type {
  WorkOrder,
  WorkOrderCommand,
  WorkOrderDetail,
} from '../work-order.types'
import { successMessage } from '../work-order.messages'

interface WorkOrderState {
  reset: () => void
  orders: WorkOrder[]
  detail: WorkOrderDetail | null
  detailId: string | null
  listActorId: string | null
  detailActorId: string | null
  loadingList: boolean
  loadingDetail: boolean
  pending: boolean
  listError: string | null
  detailError: string | null
  actionError: string | null
  notice: string | null
  loadList: (actorId: string) => Promise<void>
  loadDetail: (id: string, actorId: string) => Promise<void>
  clearDetail: () => void
  clearMessages: () => void
  perform: (
    command: WorkOrderCommand,
    actorId: string,
  ) => Promise<WorkOrder | null>
}

let listRequest = 0
let sessionVersion = 0
let detailRequest = 0
let listController: AbortController | null = null
let detailController: AbortController | null = null

export const useWorkOrderStore = create<WorkOrderState>((set, get) => ({
  reset: () => {
    ++sessionVersion
    ++listRequest
    ++detailRequest
    listController?.abort()
    detailController?.abort()
    set({
      orders: [],
      detail: null,
      detailId: null,
      listActorId: null,
      detailActorId: null,
      loadingList: false,
      loadingDetail: false,
      pending: false,
      listError: null,
      detailError: null,
      actionError: null,
      notice: null,
    })
  },
  orders: [],
  detail: null,
  detailId: null,
  listActorId: null,
  detailActorId: null,
  loadingList: false,
  loadingDetail: false,
  pending: false,
  listError: null,
  detailError: null,
  actionError: null,
  notice: null,
  loadList: async (actorId) => {
    const version = ++listRequest
    listController?.abort()
    const controller = new AbortController()
    listController = controller
    set({
      loadingList: true,
      listError: null,
      listActorId: actorId,
      orders: get().listActorId === actorId ? get().orders : [],
    })
    try {
      const orders = await getWorkOrders(actorId, controller.signal)
      if (version === listRequest) set({ orders, loadingList: false })
    } catch (error) {
      if (version === listRequest)
        set({ loadingList: false, listError: apiError(error) })
    }
  },
  loadDetail: async (id, actorId) => {
    const version = ++detailRequest
    detailController?.abort()
    const controller = new AbortController()
    detailController = controller
    set({
      detail: null,
      detailId: id,
      detailActorId: actorId,
      loadingDetail: true,
      detailError: null,
      actionError: null,
    })
    try {
      const detail = await getWorkOrder(id, actorId, controller.signal)
      if (version === detailRequest) set({ detail, loadingDetail: false })
    } catch (error) {
      if (version === detailRequest)
        set({
          detail: null,
          loadingDetail: false,
          detailError: apiError(error),
        })
    }
  },
  clearDetail: () => {
    ++detailRequest
    detailController?.abort()
    set({
      detail: null,
      detailId: null,
      detailActorId: null,
      loadingDetail: false,
      detailError: null,
      actionError: null,
    })
  },
  clearMessages: () => set({ notice: null, actionError: null }),
  perform: async (command, actorId) => {
    if (get().pending) return null
    const version = sessionVersion
    set({ pending: true, actionError: null, notice: null })
    try {
      const order = await executeCommand(command, actorId)
      if (version !== sessionVersion) return null
      set({ notice: successMessage(command) })
      // The write has succeeded even if a subsequent refresh fails. Do not repeat it.
      const refreshes: Promise<void>[] = []
      if (get().listActorId === actorId) refreshes.push(get().loadList(actorId))
      if (get().detailId === order.id && get().detailActorId === actorId) {
        refreshes.push(get().loadDetail(order.id, actorId))
      }
      await Promise.all(refreshes)
      if (version !== sessionVersion) return null
      return order
    } catch (error) {
      if (version === sessionVersion) set({ actionError: apiError(error) })
      return null
    } finally {
      if (version === sessionVersion) set({ pending: false })
    }
  },
}))
