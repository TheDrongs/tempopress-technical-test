import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkOrderStore } from '../src/work-orders/stores/work-order.store'
import {
  executeCommand,
  getWorkOrder,
  getWorkOrders,
} from '../src/work-orders/api/work-order.api'
import type {
  WorkOrder,
  WorkOrderDetail,
} from '../src/work-orders/work-order.types'

vi.mock('../src/work-orders/api/work-order.api', () => ({
  executeCommand: vi.fn(),
  getWorkOrder: vi.fn(),
  getWorkOrders: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const order = { id: 'order-1', status: 'SUBMITTED' } as WorkOrder
const detail = { ...order, sparepartRequests: [] } as unknown as WorkOrderDetail

describe('Work Order store request and mutation lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useWorkOrderStore.getState().clearDetail()
    useWorkOrderStore.setState({
      orders: [],
      loadingList: false,
      listActorId: null,
      pending: false,
      listError: null,
      detailError: null,
      notice: null,
      actionError: null,
    })
  })

  it('ignores an old detail response after the selected order changes', async () => {
    const old = deferred<WorkOrderDetail>()
    vi.mocked(getWorkOrder)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ ...detail, id: 'order-2' })
    const first = useWorkOrderStore.getState().loadDetail('order-1', 'admin')
    await useWorkOrderStore.getState().loadDetail('order-2', 'admin')
    old.resolve(detail)
    await first
    expect(useWorkOrderStore.getState().detail?.id).toBe('order-2')
  })

  it('does not restore a closed detail modal when its request finishes', async () => {
    const pending = deferred<WorkOrderDetail>()
    vi.mocked(getWorkOrder).mockReturnValueOnce(pending.promise)
    const request = useWorkOrderStore.getState().loadDetail('order-1', 'admin')
    useWorkOrderStore.getState().clearDetail()
    pending.resolve(detail)
    await request
    expect(useWorkOrderStore.getState()).toMatchObject({
      detailId: null,
      detail: null,
    })
  })

  it('does not restore a previous session list or mutation after logout clears the cache', async () => {
    const oldList = deferred<WorkOrder[]>()
    const oldWrite = deferred<WorkOrder>()
    vi.mocked(getWorkOrders).mockReturnValueOnce(oldList.promise)
    vi.mocked(executeCommand).mockReturnValueOnce(oldWrite.promise)
    const list = useWorkOrderStore.getState().loadList('admin')
    const write = useWorkOrderStore
      .getState()
      .perform({ type: 'submit', id: order.id }, 'admin')
    useWorkOrderStore.getState().reset()
    oldList.resolve([order])
    oldWrite.resolve(order)
    await list
    expect(await write).toBeNull()
    expect(useWorkOrderStore.getState()).toMatchObject({
      orders: [],
      detail: null,
      listActorId: null,
      notice: null,
      pending: false,
    })
  })

  it('keeps the newest list when user selection changes during a fetch', async () => {
    useWorkOrderStore.setState({ orders: [order], listActorId: 'admin' })
    const old = deferred<WorkOrder[]>()
    vi.mocked(getWorkOrders)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce([{ ...order, id: 'latest' }])
    const request = useWorkOrderStore.getState().loadList('admin')
    const second = useWorkOrderStore.getState().loadList('spv')
    expect(useWorkOrderStore.getState().orders).toEqual([])
    await second
    old.resolve([order])
    await request
    expect(useWorkOrderStore.getState().orders[0].id).toBe('latest')
    expect(useWorkOrderStore.getState().listActorId).toBe('spv')
  })

  it('executes one mutation with its captured actor while another submit is blocked', async () => {
    const mutation = deferred<WorkOrder>()
    vi.mocked(executeCommand).mockReturnValueOnce(mutation.promise)
    const first = useWorkOrderStore
      .getState()
      .perform({ type: 'submit', id: order.id }, 'admin')
    const duplicate = await useWorkOrderStore
      .getState()
      .perform({ type: 'submit', id: order.id }, 'spv')
    expect(duplicate).toBeNull()
    expect(executeCommand).toHaveBeenCalledExactlyOnceWith(
      { type: 'submit', id: order.id },
      'admin',
    )
    mutation.resolve(order)
    await first
    expect(useWorkOrderStore.getState().pending).toBe(false)
  })

  it('preserves a successful mutation when refresh fails and removes stale detail actions', async () => {
    useWorkOrderStore.setState({
      detail,
      detailId: order.id,
      detailActorId: 'admin',
      listActorId: 'admin',
    })
    vi.mocked(executeCommand).mockResolvedValueOnce(order)
    vi.mocked(getWorkOrder).mockRejectedValueOnce(new Error('Read failed'))
    vi.mocked(getWorkOrders).mockRejectedValueOnce(new Error('List failed'))
    const result = await useWorkOrderStore
      .getState()
      .perform({ type: 'submit', id: order.id }, 'admin')
    expect(result).toBe(order)
    expect(useWorkOrderStore.getState()).toMatchObject({
      detail: null,
      pending: false,
      actionError: null,
    })
    expect(useWorkOrderStore.getState().detailError).toBeTruthy()
    expect(useWorkOrderStore.getState().notice).toBe(
      'Sukses mengirim WO ke SPV',
    )
  })

  it('releases the mutation lock and exposes an error when the write fails', async () => {
    vi.mocked(executeCommand).mockRejectedValueOnce(new Error('Write failed'))
    expect(
      await useWorkOrderStore
        .getState()
        .perform({ type: 'submit', id: order.id }, 'admin'),
    ).toBeNull()
    expect(useWorkOrderStore.getState().pending).toBe(false)
    expect(useWorkOrderStore.getState().actionError).toBeTruthy()
    expect(getWorkOrders).not.toHaveBeenCalled()
  })
})
