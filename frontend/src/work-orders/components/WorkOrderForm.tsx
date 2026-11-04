import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input, Textarea } from '../../components/ui/input'
import { Feedback, FieldMessage, Spinner } from '../../components/ui/feedback'
import { useFormValidation } from '../../lib/use-form-validation'
import type { FieldIssues } from '../../lib/use-form-validation'
import { cn } from '../../lib/utils'
import type {
  PreparationInput,
  SparepartDraft,
  WorkOrderDetail,
} from '../work-order.types'
import {
  emptySparepart,
  MAX_PHOTO_BYTES,
  MAX_REQUEST_PHOTOS,
} from '../work-order.utils'
import { SparepartFields } from './SparepartFields'
import { StatusBadge } from './StatusBadge'
import { CharacterCount } from '../../components/ui/character-count'
import { TEXT_LIMITS, characterCount, limitText } from '../../lib/text-limits'

export function WorkOrderForm({
  order,
  pending,
  serverError,
  onCancel,
  onSubmit,
}: {
  order?: WorkOrderDetail
  pending: boolean
  serverError: string | null
  onCancel: () => void
  onSubmit: (input: PreparationInput) => Promise<void>
}) {
  const [title, setTitle] = useState(order?.title ?? '')
  const [description, setDescription] = useState(order?.description ?? '')
  const [needsSpareparts, setNeedsSpareparts] = useState<boolean | null>(null)
  const [items, setItems] = useState(() => [emptySparepart()])
  const validation = useFormValidation()
  const previews = useRef(new Set<string>())
  useEffect(() => {
    const urls = previews.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  function updateItems(next: SparepartDraft[]) {
    const removed = items.filter(
      (item) => !next.some((current) => current.key === item.key),
    )
    validation.clear(
      'sparepart-items',
      ...removed.flatMap((item) => [
        `name-${item.key}`,
        `qty-${item.key}`,
        `photo-${item.key}`,
      ]),
    )
    const updated = next.map((item) => {
      const previous = items.find((old) => old.key === item.key)
      if (item.file === previous?.file) return item
      const previewUrl = item.file ? URL.createObjectURL(item.file) : undefined
      if (previewUrl) previews.current.add(previewUrl)
      return { ...item, previewUrl }
    })
    for (const url of previews.current) {
      if (!updated.some((item) => item.previewUrl === url)) {
        URL.revokeObjectURL(url)
        previews.current.delete(url)
      }
    }
    setItems(updated)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    const issues: FieldIssues = {}
    if (!title.trim()) {
      issues['wo-title'] = 'Judul Work Order wajib diisi.'
    }
    if (characterCount(title.trim()) > TEXT_LIMITS.title)
      issues['wo-title'] = 'Judul maksimal 50 karakter.'
    if (characterCount(description) > TEXT_LIMITS.description)
      issues['wo-description'] = 'Deskripsi maksimal 100 karakter.'
    if (order && needsSpareparts === null) {
      issues['needs-spareparts'] =
        'Pilih apakah pekerjaan membutuhkan sparepart.'
    }
    if (needsSpareparts) {
      if (!items.length) {
        issues['sparepart-items'] = 'Tambahkan minimal satu item sparepart.'
      }
      for (const item of items) {
        if (!item.name.trim())
          issues[`name-${item.key}`] = 'Nama sparepart wajib diisi.'
        if (characterCount(item.name.trim()) > TEXT_LIMITS.sparepartName)
          issues[`name-${item.key}`] = 'Nama sparepart maksimal 30 karakter.'
        if (
          !/^\d+$/.test(item.qty) ||
          Number(item.qty) < 1 ||
          Number(item.qty) > 2147483647
        ) {
          issues[`qty-${item.key}`] =
            'Jumlah harus berupa bilangan bulat antara 1 dan 2147483647.'
        }
        if (validation.issues[`photo-${item.key}`])
          issues[`photo-${item.key}`] = validation.issues[`photo-${item.key}`]
        if (
          item.file &&
          (!['image/jpeg', 'image/png'].includes(item.file.type) ||
            item.file.size === 0 ||
            item.file.size > MAX_PHOTO_BYTES)
        ) {
          issues[`photo-${item.key}`] = 'Gunakan foto JPG/PNG maksimal 2 MB.'
        }
      }
      if (items.filter((item) => item.file).length > MAX_REQUEST_PHOTOS) {
        issues['sparepart-items'] = 'Maksimal 10 foto per pengajuan.'
      }
    }
    if (!validation.report(issues)) return
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      needsSpareparts: needsSpareparts === true,
      items: needsSpareparts ? items : [],
    })
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event)
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
        {order && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold tracking-tight">{order.title}</h3>
            <StatusBadge status={order.status} />
          </div>
        )}
        <fieldset
          disabled={pending}
          className="grid gap-5 rounded-xl border bg-slate-50/60 p-4 sm:grid-cols-2 sm:p-5"
        >
          <div className={order ? '' : 'sm:col-span-2'}>
            <label
              htmlFor="wo-title"
              className="mb-2 block text-sm font-medium"
            >
              Judul <span className="text-destructive">*</span>
            </label>
            <Input
              id="wo-title"
              {...validation.fieldProps('wo-title')}
              aria-describedby={[
                validation.fieldProps('wo-title')['aria-describedby'],
                'wo-title-count',
              ]
                .filter(Boolean)
                .join(' ')}
              name="title"
              required
              value={title}
              placeholder="Contoh: Perbaikan rem belakang"
              onChange={(event) => {
                setTitle(limitText(event.target.value, TEXT_LIMITS.title))
                validation.clear('wo-title')
              }}
            />
            <CharacterCount
              fieldId="wo-title"
              value={title}
              maximum={TEXT_LIMITS.title}
            />
            <FieldMessage
              id="wo-title"
              message={validation.inlineMessage('wo-title')}
            />
          </div>
          {order && (
            <div>
              <span className="mb-2 block text-sm font-medium">
                Mechanic ditugaskan
              </span>
              <div className="flex h-10 items-center rounded-lg border bg-muted px-3 text-sm">
                {order.assignedMechanic?.name ?? '—'}
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <label
              htmlFor="wo-description"
              className="mb-2 block text-sm font-medium"
            >
              Deskripsi{' '}
              <span className="font-normal text-muted-foreground">
                (opsional)
              </span>
            </label>
            <Textarea
              id="wo-description"
              {...validation.fieldProps('wo-description')}
              aria-describedby={[
                validation.fieldProps('wo-description')['aria-describedby'],
                'wo-description-count',
              ]
                .filter(Boolean)
                .join(' ')}
              name="description"
              value={description}
              placeholder="Jelaskan pekerjaan atau kondisi yang perlu diperbaiki..."
              onChange={(event) => {
                setDescription(
                  limitText(event.target.value, TEXT_LIMITS.description),
                )
                validation.clear('wo-description')
              }}
            />
            <CharacterCount
              fieldId="wo-description"
              value={description}
              maximum={TEXT_LIMITS.description}
            />
            <FieldMessage
              id="wo-description"
              message={validation.inlineMessage('wo-description')}
            />
          </div>
        </fieldset>
        {order && (
          <>
            <fieldset
              id="needs-spareparts"
              {...validation.fieldProps('needs-spareparts')}
              disabled={pending}
              className={cn(
                'flex flex-wrap items-center gap-5 rounded-lg border border-transparent p-3',
                validation.fieldProps('needs-spareparts').className,
                validation.issues['needs-spareparts'] && 'border-destructive',
              )}
            >
              <legend className="mb-3 text-sm font-semibold">
                Butuh sparepart? <span className="text-destructive">*</span>
              </legend>
              {([true, false] as const).map((value) => (
                <label
                  key={String(value)}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    className="size-4 accent-primary"
                    name="needs-spareparts"
                    checked={needsSpareparts === value}
                    onChange={() => {
                      setNeedsSpareparts(value)
                      validation.clear(
                        'needs-spareparts',
                        'sparepart-items',
                        ...Object.keys(validation.issues).filter(
                          (key) =>
                            key.startsWith('name-') ||
                            key.startsWith('qty-') ||
                            key.startsWith('photo-'),
                        ),
                      )
                    }}
                  />
                  {value ? 'Ya' : 'Tidak'}
                </label>
              ))}
            </fieldset>
            <FieldMessage
              id="needs-spareparts"
              message={validation.inlineMessage('needs-spareparts')}
            />
            {needsSpareparts === true && (
              <SparepartFields
                items={items}
                onChange={updateItems}
                disabled={pending}
                validation={validation}
              />
            )}
            {needsSpareparts === false && (
              <p className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm leading-relaxed text-teal-900">
                Setelah disimpan, WO siap dikerjakan oleh mechanic tanpa
                pengajuan sparepart.
              </p>
            )}
          </>
        )}
        {validation.generalMessage && (
          <Feedback>{validation.generalMessage}</Feedback>
        )}
        {serverError && validation.count === 0 && (
          <Feedback>{serverError}</Feedback>
        )}
      </div>
      <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-end gap-3 border-t bg-white px-5 py-4 sm:px-7">
        <Button variant="outline" disabled={pending} onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Spinner label="Menyimpan..." />
          ) : (
            <>
              <Send />
              {!order
                ? 'Buat Work Order'
                : needsSpareparts
                  ? 'Simpan & Ajukan Sparepart'
                  : 'Simpan Persiapan'}
            </>
          )}
        </Button>
      </footer>
    </form>
  )
}
