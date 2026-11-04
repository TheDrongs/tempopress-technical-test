import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  Eye,
  Plus,
  RefreshCw,
  Wrench,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Select } from '../components/ui/input'
import { Button } from '../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/ui/dialog'
import { Feedback, Spinner } from '../components/ui/feedback'
import { useUserStore } from '../stores/user.store'
import { useWorkOrderStore } from './stores/work-order.store'
import { StatusBadge } from './components/StatusBadge'
import { WorkOrderForm } from './components/WorkOrderForm'
import { WorkOrderTaskPanel } from './components/WorkOrderTaskPanel'
import { formatDate } from './work-order.utils'
import { roleLabels } from '../types/user.types'

export function WorkOrderListPage() {
  const navigate = useNavigate()
  const { activeUserId, users, loading: loadingUsers } = useUserStore()
  const {
    orders: storedOrders,
    listActorId,
    loadingList,
    listError,
    actionError,
    notice,
    pending,
    loadList,
    clearMessages,
    perform,
  } = useWorkOrderStore()
  const [creating, setCreating] = useState(false)
  const [pagination, setPagination] = useState({
    actorId: activeUserId,
    page: 1,
    size: 5,
  })
  const actor = users.find((user) => user.id === activeUserId)
  const orders = listActorId === activeUserId ? storedOrders : []
  const pageSize = pagination.actorId === activeUserId ? pagination.size : 5
  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize))
  const page = Math.min(
    pagination.actorId === activeUserId ? pagination.page : 1,
    totalPages,
  )
  const visibleOrders = orders.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => {
    if (activeUserId) void loadList(activeUserId)
  }, [activeUserId, loadList])
  function openCreate() {
    clearMessages()
    setCreating(true)
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Operasional
          </p>
          <h1
            id="work-orders-heading"
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight outline-none sm:text-4xl"
          >
            Work Orders{actor ? ` - ${roleLabels[actor.role]} Panel` : ''}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Kelola pekerjaan dan progres perbaikan.
          </p>
        </div>
        {actor?.role === 'ADMIN' && (
          <Button onClick={openCreate} disabled={pending} className="h-11">
            <Plus />
            Buat Work Order
          </Button>
        )}
      </div>
      {notice && (
        <Feedback success onDismiss={clearMessages} className="mb-5">
          {notice}
        </Feedback>
      )}
      {listError && (
        <Feedback className="mb-5">
          {listError}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            disabled={loadingList || pending}
            onClick={() => {
              void loadList(activeUserId)
            }}
          >
            <RefreshCw />
            Coba lagi
          </Button>
        </Feedback>
      )}
      {actor &&
        !loadingList &&
        !listError &&
        !pending &&
        listActorId === activeUserId && (
          <WorkOrderTaskPanel orders={orders} actor={actor} />
        )}
      <section
        aria-label="Daftar Work Order"
        className="overflow-hidden rounded-2xl border bg-white shadow-[0_3px_20px_-12px_rgba(18,43,49,0.18)]"
      >
        <div className="flex min-h-14 items-center justify-between gap-3 border-b px-5 py-3">
          <p className="text-sm font-semibold">
            Daftar pekerjaan{' '}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {orders.length}
            </span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={!actor || loadingList || pending}
            onClick={() => {
              void loadList(activeUserId)
            }}
          >
            <RefreshCw className={loadingList ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Muat ulang</span>
          </Button>
        </div>
        {(!actor && loadingUsers) || (loadingList && orders.length === 0) ? (
          <div className="py-20 text-center">
            <Spinner label="Memuat daftar Work Order..." />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center sm:py-20">
            <span className="mb-5 rounded-2xl border border-teal-100 bg-teal-50 p-5 text-primary">
              <ClipboardList aria-hidden="true" className="size-8" />
            </span>
            <h2 className="text-lg font-bold">
              {listError ? 'Daftar belum dapat dimuat' : 'Belum ada Work Order'}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {listError
                ? 'Coba muat ulang untuk mendapatkan data terbaru.'
                : actor?.role === 'ADMIN'
                  ? 'Buat Work Order pertama untuk memulai alur pekerjaan dan pengajuan sparepart.'
                  : 'Work Order yang dibuat Admin akan tampil di sini.'}
            </p>
            {actor?.role === 'ADMIN' && !listError && (
              <Button className="mt-6" onClick={openCreate} disabled={pending}>
                <Plus />
                Buat Work Order Pertama
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-200 text-left text-sm">
              <thead className="bg-[#eaf5f1] text-xs text-teal-950">
                <tr>
                  {['Judul', 'Status', 'Mechanic', 'Dibuat', 'Aksi'].map(
                    (title) => (
                      <th
                        key={title}
                        scope="col"
                        className="px-5 py-4 font-semibold"
                      >
                        {title}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t transition hover:bg-slate-50/70"
                  >
                    <td className="max-w-96 px-5 py-5">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-teal-50 p-2.5 text-primary">
                          <Wrench aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold break-words">
                            {order.title}
                          </p>
                          {order.description && (
                            <p className="mt-1 line-clamp-1 max-w-72 text-xs text-muted-foreground">
                              {order.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-5 text-muted-foreground">
                      {users.find(
                        (user) => user.id === order.assignedMechanicId,
                      )?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-5 text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-5 py-5">
                      <Link
                        id={`wo-${order.id}`}
                        to={`/work-orders/${order.id}`}
                        aria-label={`Lihat detail ${order.title}`}
                        aria-disabled={pending || loadingList}
                        onClick={(event) => {
                          if (pending || loadingList) event.preventDefault()
                          else clearMessages()
                        }}
                        className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition hover:border-primary/40 hover:bg-teal-50 hover:text-primary aria-disabled:opacity-50"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                        Lihat detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t bg-slate-50/50 px-5 py-3 text-xs text-muted-foreground">
          <span>
            {orders.length ? (page - 1) * pageSize + 1 : 0}–
            {Math.min(page * pageSize, orders.length)} dari {orders.length} Work
            Order
          </span>
          <nav
            aria-label="Pagination Work Order"
            className="flex flex-wrap items-center gap-3"
          >
            <label htmlFor="wo-page-size">Data per halaman</label>
            <Select
              id="wo-page-size"
              value={pageSize}
              className="h-8 w-20 text-xs"
              disabled={loadingList || pending}
              onChange={(event) =>
                setPagination({
                  actorId: activeUserId,
                  page: 1,
                  size: Number(event.target.value),
                })
              }
            >
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
            <div className="inline-flex items-center gap-3">
              <span aria-live="polite">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Halaman sebelumnya"
                disabled={page <= 1 || loadingList || pending}
                onClick={() =>
                  setPagination({
                    actorId: activeUserId,
                    page: page - 1,
                    size: pageSize,
                  })
                }
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Halaman berikutnya"
                disabled={page >= totalPages || loadingList || pending}
                onClick={() =>
                  setPagination({
                    actorId: activeUserId,
                    page: page + 1,
                    size: pageSize,
                  })
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </nav>
        </div>
      </section>
      <Dialog
        open={creating}
        onOpenChange={(open) => {
          if (!pending) setCreating(open)
        }}
      >
        <DialogContent
          busy={pending}
          className="max-w-2xl"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <header className="border-b px-5 py-5 pr-14 sm:px-7">
            <DialogTitle className="text-lg font-bold">
              Buat Work Order
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Harap lengkapi informasi pekerjaan. Formulir{' '}
              <strong className="font-bold">WO</strong> disimpan sebagai{' '}
              <strong className="font-bold">draft</strong> sebelum dikirim ke{' '}
              <strong className="font-bold">SPV</strong>.
            </DialogDescription>
          </header>
          {creating && (
            <WorkOrderForm
              pending={pending}
              serverError={actionError}
              onCancel={() => setCreating(false)}
              onSubmit={async (input) => {
                const created = await perform(
                  {
                    type: 'create',
                    input: {
                      title: input.title,
                      description: input.description,
                    },
                  },
                  activeUserId,
                )
                if (created) {
                  setCreating(false)
                  clearMessages()
                  void navigate(`/work-orders/${created.id}`, {
                    state: { draftCreatedId: created.id },
                  })
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Outlet />
    </>
  )
}
