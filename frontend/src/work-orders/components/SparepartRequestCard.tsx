import { useState } from 'react'
import { CheckCircle2, CheckCheck } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/input'
import { CharacterCount } from '../../components/ui/character-count'
import { TEXT_LIMITS, characterCount, limitText } from '../../lib/text-limits'
import { useFormValidation } from '../../lib/use-form-validation'
import { FieldMessage } from '../../components/ui/feedback'
import { Spinner } from '../../components/ui/feedback'
import type { SparepartRequest } from '../work-order.types'
import { cn } from '../../lib/utils'
import { PhotoPreview, PhotoThumbnail } from './PhotoPreview'
import type { PhotoSelection } from './PhotoPreview'

export function SparepartRequestCard({
  request,
  canApprove,
  pending,
  onApprove,
}: {
  request: SparepartRequest
  canApprove: boolean
  pending: boolean
  onApprove: (note: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const validation = useFormValidation()
  const noteId = `approval-note-${request.id}`
  const [photo, setPhoto] = useState<PhotoSelection | null>(null)
  const approved = request.status === 'APPROVED'
  return (
    <section
      className="rounded-xl border bg-white p-4 shadow-xs sm:p-5"
      aria-label="Pengajuan sparepart"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-base font-bold">Pengajuan Sparepart</h3>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold',
            approved
              ? 'bg-emerald-50 text-emerald-800'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          {approved ? 'Disetujui' : 'Pending'}
        </span>
      </div>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Pemohon:{' '}
        <span className="font-semibold text-foreground">
          {request.requestedByUser.name}
        </span>
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-80 text-left text-sm">
          <thead className="bg-teal-50 text-xs text-teal-950">
            <tr>
              <th scope="col" className="w-24 px-3 py-3 font-semibold">
                Foto
              </th>
              <th scope="col" className="px-3 py-3 font-semibold">
                Nama sparepart
              </th>
              <th
                scope="col"
                className="w-20 px-3 py-3 text-right font-semibold"
              >
                Jumlah
              </th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-3">
                  <PhotoThumbnail
                    key={item.imageUrl}
                    src={item.imageUrl}
                    name={item.name}
                    onView={() => {
                      if (item.imageUrl)
                        setPhoto({
                          src: item.imageUrl,
                          name: item.name,
                          qty: item.qty,
                        })
                    }}
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium break-words">{item.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.imageUrl
                      ? 'Klik foto untuk memperbesar'
                      : 'Tanpa foto'}
                  </p>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {item.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {approved && (
        <div className="mt-4 rounded-lg bg-emerald-50/70 px-3 py-3 text-xs leading-relaxed text-emerald-950">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Disetujui oleh {request.approvedByUser?.name ?? 'SPV'}
          </p>
          {request.approvalNote && (
            <p className="mt-2 whitespace-pre-wrap break-words">
              {request.approvalNote}
            </p>
          )}
        </div>
      )}
      {canApprove && (
        <form
          className="mt-5 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (
              !pending &&
              validation.report(
                characterCount(note) > TEXT_LIMITS.approvalNote
                  ? { [noteId]: 'Catatan persetujuan maksimal 100 karakter.' }
                  : {},
              )
            )
              void onApprove(note)
          }}
        >
          <label
            htmlFor={`approval-note-${request.id}`}
            className="block text-sm font-medium"
          >
            Catatan persetujuan{' '}
            <span className="font-normal text-muted-foreground">
              (opsional)
            </span>
          </label>
          <Textarea
            id={`approval-note-${request.id}`}
            {...validation.fieldProps(noteId)}
            aria-describedby={[
              validation.fieldProps(noteId)['aria-describedby'],
              `${noteId}-count`,
            ]
              .filter(Boolean)
              .join(' ')}
            value={note}
            onChange={(event) => {
              setNote(limitText(event.target.value, TEXT_LIMITS.approvalNote))
              validation.clear(noteId)
            }}
            disabled={pending}
            placeholder="Tambahkan catatan bila diperlukan..."
          />
          <CharacterCount
            fieldId={noteId}
            value={note}
            maximum={TEXT_LIMITS.approvalNote}
          />
          <FieldMessage
            id={noteId}
            message={validation.inlineMessage(noteId)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Spinner label="Menyetujui..." />
              ) : (
                <>
                  <CheckCheck />
                  Setujui Pengajuan Sparepart
                </>
              )}
            </Button>
          </div>
        </form>
      )}
      <PhotoPreview photo={photo} onClose={() => setPhoto(null)} />
    </section>
  )
}
