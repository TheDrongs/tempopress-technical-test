import { useRef, useState } from 'react'
import { Camera, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { CharacterCount } from '../../components/ui/character-count'
import { TEXT_LIMITS, limitText } from '../../lib/text-limits'
import { FieldMessage } from '../../components/ui/feedback'
import { cn } from '../../lib/utils'
import type { FormValidation } from '../../lib/use-form-validation'
import type { SparepartDraft } from '../work-order.types'
import {
  emptySparepart,
  MAX_PHOTO_BYTES,
  MAX_REQUEST_PHOTOS,
} from '../work-order.utils'
import { PhotoPreview, PhotoThumbnail } from './PhotoPreview'
import type { PhotoSelection } from './PhotoPreview'

export function SparepartFields({
  items,
  onChange,
  disabled,
  validation,
}: {
  items: SparepartDraft[]
  onChange: (items: SparepartDraft[]) => void
  disabled: boolean
  validation: FormValidation
}) {
  const count = items.filter((item) => item.file).length
  function update(key: string, patch: Partial<SparepartDraft>) {
    validation.clear(
      ...Object.keys(patch)
        .filter((field) => ['name', 'qty', 'file'].includes(field))
        .map((field) => `${field === 'file' ? 'photo' : field}-${key}`),
    )
    onChange(
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }
  function selectFile(item: SparepartDraft, file: File) {
    if (
      !['image/jpeg', 'image/png'].includes(file.type) ||
      file.size === 0 ||
      file.size > MAX_PHOTO_BYTES
    ) {
      validation.report({
        ...validation.issues,
        [`photo-${item.key}`]:
          'Gunakan foto JPG/PNG maksimal 2 MB. Pilihan foto sebelumnya tidak diganti.',
      })
      return
    }
    if (!item.file && count >= MAX_REQUEST_PHOTOS) {
      validation.report({
        ...validation.issues,
        [`photo-${item.key}`]:
          'Maksimal 10 foto per pengajuan. Hapus salah satu foto sebelum menambahkan yang baru.',
      })
      return
    }
    update(item.key, { file })
  }
  return (
    <section aria-labelledby="sparepart-fields-heading" className="space-y-4">
      <div>
        <h3 id="sparepart-fields-heading" className="text-base font-bold">
          Pengajuan Sparepart
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Foto opsional · 1 foto per item · JPG/PNG maks. 2 MB
        </p>
      </div>
      <div
        id="sparepart-items"
        {...validation.fieldProps('sparepart-items')}
        className={cn(
          'overflow-hidden rounded-xl border',
          validation.fieldProps('sparepart-items').className,
          validation.issues['sparepart-items'] && 'border-destructive',
        )}
      >
        <div className="hidden grid-cols-[minmax(0,1fr)_80px_minmax(240px,1fr)_40px] gap-3 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-950 lg:grid">
          <span>Nama sparepart</span>
          <span>Jumlah</span>
          <span>Foto (opsional)</span>
          <span className="sr-only">Aksi</span>
        </div>
        {items.map((item, index) => (
          <fieldset
            disabled={disabled}
            key={item.key}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_72px] items-start gap-3 border-t p-4 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_80px_minmax(240px,1fr)_40px]"
          >
            <legend className="sr-only">Sparepart {index + 1}</legend>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium lg:sr-only"
                htmlFor={`name-${item.key}`}
              >
                Nama sparepart {index + 1}
              </label>
              <Input
                id={`name-${item.key}`}
                {...validation.fieldProps(`name-${item.key}`)}
                aria-describedby={[
                  validation.fieldProps(`name-${item.key}`)['aria-describedby'],
                  `name-${item.key}-count`,
                ]
                  .filter(Boolean)
                  .join(' ')}
                value={item.name}
                required
                placeholder="Nama sparepart"
                onChange={(event) =>
                  update(item.key, {
                    name: limitText(
                      event.target.value,
                      TEXT_LIMITS.sparepartName,
                    ),
                  })
                }
              />
              <CharacterCount
                fieldId={`name-${item.key}`}
                value={item.name}
                maximum={TEXT_LIMITS.sparepartName}
              />
              <FieldMessage
                id={`name-${item.key}`}
                message={validation.inlineMessage(`name-${item.key}`)}
              />
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium lg:sr-only"
                htmlFor={`qty-${item.key}`}
              >
                Jumlah {index + 1}
              </label>
              <Input
                id={`qty-${item.key}`}
                {...validation.fieldProps(`qty-${item.key}`)}
                type="number"
                min="1"
                max="2147483647"
                step="1"
                value={item.qty}
                required
                onChange={(event) =>
                  update(item.key, { qty: event.target.value })
                }
              />
              <FieldMessage
                id={`qty-${item.key}`}
                message={validation.inlineMessage(`qty-${item.key}`)}
              />
            </div>
            <div className="col-span-2 min-w-0 lg:col-span-1">
              <DraftPhoto
                item={item}
                disabled={disabled}
                onFile={(file) => selectFile(item, file)}
                onRemove={() => update(item.key, { file: null })}
                validation={validation}
              />
            </div>
            <Button
              variant="destructive"
              size="icon"
              className="col-start-2 row-start-3 justify-self-end lg:col-auto lg:row-auto lg:h-10"
              aria-label={`Hapus item ${index + 1}`}
              disabled={disabled}
              onClick={() => {
                onChange(items.filter((current) => current.key !== item.key))
              }}
            >
              <Trash2 />
            </Button>
          </fieldset>
        ))}
        {items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Tambahkan minimal satu sparepart untuk membuat pengajuan.
          </p>
        )}
      </div>
      <FieldMessage
        id="sparepart-items"
        message={validation.inlineMessage('sparepart-items')}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...items, emptySparepart()])}
        >
          <Plus />
          Tambah item
        </Button>
        <p className="text-xs text-muted-foreground">
          {count} dari maksimal 10 foto per pengajuan
        </p>
      </div>
    </section>
  )
}

function DraftPhoto({
  item,
  disabled,
  onFile,
  onRemove,
  validation,
}: {
  item: SparepartDraft
  disabled: boolean
  onFile: (file: File) => void
  onRemove: () => void
  validation: FormValidation
}) {
  const input = useRef<HTMLInputElement>(null)
  const url = item.previewUrl ?? null
  const [photo, setPhoto] = useState<PhotoSelection | null>(null)
  return (
    <div>
      <div
        id={`photo-${item.key}`}
        role="group"
        {...validation.fieldProps(`photo-${item.key}`)}
        className={cn(
          'flex min-h-10 items-center gap-3 rounded-lg border border-transparent px-1',
          validation.fieldProps(`photo-${item.key}`).className,
          validation.issues[`photo-${item.key}`] && 'border-destructive',
        )}
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          aria-label={`Foto ${item.name || 'sparepart'}`}
          aria-invalid={Boolean(validation.issues[`photo-${item.key}`])}
          aria-describedby={
            validation.fieldProps(`photo-${item.key}`)['aria-describedby']
          }
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(file)
            event.target.value = ''
          }}
        />
        {item.file && url ? (
          <>
            <PhotoThumbnail
              key={url}
              src={url}
              name={item.name || 'sparepart'}
              onView={() =>
                setPhoto({
                  src: url,
                  name: item.name || 'Sparepart',
                  qty: Number(item.qty) || 1,
                })
              }
            />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1 text-primary"
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <RefreshCw />
                Ganti
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-1"
                disabled={disabled}
                onClick={onRemove}
              >
                <Trash2 />
                Hapus foto
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              className="border-dashed text-primary"
              disabled={disabled}
              onClick={() => input.current?.click()}
            >
              <Camera />
              Tambah foto
            </Button>
            <span className="text-xs text-muted-foreground">
              Belum ada foto
            </span>
            {validation.issues[`photo-${item.key}`] && (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onRemove}
              >
                Batalkan foto
              </Button>
            )}
          </>
        )}
        <PhotoPreview photo={photo} onClose={() => setPhoto(null)} />
      </div>
      <FieldMessage
        id={`photo-${item.key}`}
        message={validation.inlineMessage(`photo-${item.key}`)}
      />
    </div>
  )
}
