import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Feedback, Spinner } from '../components/ui/feedback'
import { useUserStore } from '../stores/user.store'
import { useWorkOrderStore } from './stores/work-order.store'
import { WorkOrderForm } from './components/WorkOrderForm'
import { WorkOrderActions } from './components/WorkOrderActions'
import { StatusBadge } from './components/StatusBadge'
import { SparepartRequestCard } from './components/SparepartRequestCard'
import { formatDate } from './work-order.utils'
import type { WorkOrderCommand } from './work-order.types'
import { ActionSuccessDialog } from './components/ActionSuccessDialog'
import { successMessage } from './work-order.messages'
import { cn } from '../lib/utils'

export function WorkOrderDetailPage() {
  const { workOrderId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const createdOrderId = (location.state as { draftCreatedId?: string } | null)
    ?.draftCreatedId
  const [successOrderId, setSuccessOrderId] = useState(
    () => createdOrderId ?? null,
  )
  const showSuccess = successOrderId === workOrderId
  const [successTitle, setSuccessTitle] = useState('Sukses membuat Draft WO')
  const { users, activeUserId, error: userError, initialize } = useUserStore()
  const {
    detail: storedDetail,
    detailActorId,
    loadingDetail,
    detailError,
    actionError,
    pending,
    notice,
    loadDetail,
    clearDetail,
    perform,
    clearMessages,
  } = useWorkOrderStore()
  const actor = users.find((user) => user.id === activeUserId)
  const detail = detailActorId === activeUserId ? storedDetail : null
  useEffect(() => {
    if (activeUserId) void loadDetail(workOrderId, activeUserId)
    return clearDetail
  }, [workOrderId, activeUserId, loadDetail, clearDetail])
  useEffect(() => {
    if (createdOrderId === workOrderId) {
      // Consume the one-time navigation flag so reload/back cannot replay success.
      void navigate(location.pathname, { replace: true, state: null })
    }
  }, [createdOrderId, workOrderId, location.pathname, navigate])
  const close = () => {
    if (!pending && !showSuccess) void navigate('/work-orders')
  }
  function closeSuccess() {
    setSuccessOrderId(null)
    clearMessages()
    void navigate('/work-orders', { replace: true })
  }
  const prepare = detail?.status === 'ASSIGNED' && actor?.role === 'ADMIN'
  async function action(command: WorkOrderCommand) {
    const result = await perform(command, activeUserId)
    if (result) {
      clearMessages()
      setSuccessTitle(successMessage(command))
      setSuccessOrderId(result.id)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        busy={pending || showSuccess}
        className={cn(
          'max-w-4xl',
          showSuccess && 'pointer-events-none select-none blur-sm',
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          ;(
            document.getElementById(`wo-${workOrderId}`) ??
            document.getElementById('work-orders-heading')
          )?.focus()
        }}
      >
        <header className="shrink-0 border-b px-5 py-5 pr-14 sm:px-7">
          <DialogTitle className="text-lg font-bold tracking-tight">
            {prepare ? 'Persiapan Work Order' : 'Detail Work Order'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Informasi pekerjaan, pengajuan sparepart, dan tindakan sesuai
            pengguna aktif.
          </DialogDescription>
        </header>
        {!actor || loadingDetail ? (
          <div className="p-10 text-center">
            {userError ? (
              <>
                <Feedback>{userError}</Feedback>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    void initialize()
                  }}
                >
                  Coba lagi
                </Button>
              </>
            ) : (
              <Spinner label="Memuat detail Work Order..." />
            )}
          </div>
        ) : detailError || !detail ? (
          <div className="space-y-4 p-6">
            <Feedback>{detailError ?? 'Work Order tidak ditemukan.'}</Feedback>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={close}>
                Tutup
              </Button>
              <Button
                onClick={() => {
                  void loadDetail(workOrderId, activeUserId)
                }}
              >
                <RefreshCw />
                Muat Ulang Detail
              </Button>
            </div>
          </div>
        ) : prepare ? (
          <WorkOrderForm
            key={`${detail.id}-${activeUserId}-${detail.status}`}
            order={detail}
            pending={pending}
            serverError={actionError}
            onCancel={close}
            onSubmit={async (input) => {
              await action({ type: 'prepare', id: detail.id, input })
            }}
          />
        ) : (
          <>
            <div className="space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold tracking-tight break-words sm:text-2xl">
                  {detail.title}
                </h2>
                <StatusBadge
                  status={detail.status}
                  showLabel
                  className="text-[0.9rem]"
                />
              </div>
              {notice && <Feedback success>{notice}</Feedback>}
              <dl className="grid grid-cols-1 gap-x-8 gap-y-5 rounded-xl border bg-slate-50/60 p-4 text-sm sm:grid-cols-2 sm:p-5">
                {[
                  ['Pembuat', detail.createdByUser.name],
                  ['SPV', detail.assignedSpv?.name ?? 'Belum dikirim'],
                  [
                    'Mechanic',
                    detail.assignedMechanic?.name ?? 'Belum ditugaskan',
                  ],
                  ['Mulai', formatDate(detail.startDate, true)],
                  ['Selesai', formatDate(detail.endDate, true)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="mb-1 text-xs text-muted-foreground">
                      {label}
                    </dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                ))}
                <div className="border-t pt-4 sm:col-span-2">
                  <dt className="mb-2 text-xs text-muted-foreground">
                    Deskripsi
                  </dt>
                  <dd className="whitespace-pre-wrap leading-relaxed break-words">
                    {detail.description || 'Tidak ada deskripsi tambahan.'}
                  </dd>
                </div>
              </dl>
              {detail.sparepartRequests.map((request) => (
                <SparepartRequestCard
                  key={request.id}
                  request={request}
                  pending={pending}
                  canApprove={
                    actor.role === 'SPV' &&
                    detail.status === 'WAITING_SPAREPART_APPROVAL' &&
                    request.status === 'PENDING'
                  }
                  onApprove={async (approvalNote) => {
                    await action({
                      type: 'approve',
                      requestId: request.id,
                      approvalNote,
                    })
                  }}
                />
              ))}
              {actionError && (
                <Feedback>
                  {actionError}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3"
                    disabled={pending}
                    onClick={() => {
                      void loadDetail(workOrderId, activeUserId)
                    }}
                  >
                    Muat Ulang Detail
                  </Button>
                </Feedback>
              )}
            </div>
            <WorkOrderActions
              key={`${detail.id}-${activeUserId}-${detail.status}`}
              order={detail}
              actor={actor}
              users={users}
              pending={pending}
              onAction={action}
            />
          </>
        )}
      </DialogContent>
      <ActionSuccessDialog
        title={successTitle}
        open={
          showSuccess &&
          !loadingDetail &&
          (detail?.id === workOrderId || Boolean(detailError))
        }
        onClose={closeSuccess}
      />
    </Dialog>
  )
}
