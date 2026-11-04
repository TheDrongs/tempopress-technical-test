import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Spinner({ label = 'Memuat data...' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label}
    </span>
  )
}

export function FieldMessage({
  id,
  message,
}: {
  id: string
  message?: string
}) {
  return message ? (
    <p
      id={`${id}-error`}
      role="alert"
      className="mt-1.5 text-xs leading-relaxed text-destructive"
    >
      {message}
    </p>
  ) : null
}

export function Feedback({
  children,
  success = false,
  onDismiss,
  className,
}: {
  children: ReactNode
  success?: boolean
  onDismiss?: () => void
  className?: string
}) {
  const Icon = success ? CheckCircle2 : AlertCircle
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed',
        success
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-red-200 bg-red-50 text-red-900',
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          className="rounded p-0.5 hover:bg-black/5"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
