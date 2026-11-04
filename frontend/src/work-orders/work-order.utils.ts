import type { SparepartDraft } from './work-order.types'

export function emptySparepart(): SparepartDraft {
  return { key: crypto.randomUUID(), name: '', qty: '1', file: null }
}

export function formatDate(value: string | null, withTime = false): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
      : {}),
  }).format(date)
}

export function localDateTime(value = new Date().toISOString()): string {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 23)
}

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
export const MAX_REQUEST_PHOTOS = 10
