import { useState } from 'react'
import { Expand, ImageOff, ImagePlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'

export interface PhotoSelection {
  src: string
  name: string
  qty: number
}

export function PhotoPreview({
  photo,
  onClose,
}: {
  photo: PhotoSelection | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={photo !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-3xl">
        <header className="border-b px-6 py-5 pr-14">
          <DialogTitle className="text-lg font-bold">
            Foto sparepart
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {photo?.name} · Jumlah: {photo?.qty}
          </DialogDescription>
        </header>
        {photo && <PreviewImage key={photo.src} photo={photo} />}
        <footer className="flex justify-end border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Kembali ke detail
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function PreviewImage({ photo }: { photo: PhotoSelection }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex min-h-40 items-center justify-center overflow-auto bg-muted/50 p-3 sm:p-5">
      {failed ? (
        <p
          role="status"
          className="flex items-center gap-2 py-12 text-sm text-muted-foreground"
        >
          <ImageOff className="size-5" />
          Foto tidak tersedia.
        </p>
      ) : (
        <img
          src={photo.src}
          alt={`Foto ${photo.name}`}
          className="max-h-[65dvh] w-full rounded-lg object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export function PhotoThumbnail({
  src,
  name,
  onView,
}: {
  src: string | null
  name: string
  onView?: () => void
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <div
        className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed bg-muted/70 text-muted-foreground"
        title={failed ? 'Foto tidak tersedia' : 'Tanpa foto'}
      >
        {failed ? (
          <ImageOff aria-label="Foto tidak tersedia" className="size-5" />
        ) : (
          <ImagePlus aria-label="Tanpa foto" className="size-5 opacity-60" />
        )}
      </div>
    )
  return (
    <button
      type="button"
      onClick={onView}
      aria-label={`Lihat foto ${name}`}
      className="group relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="size-full object-cover transition group-hover:scale-105"
        onError={() => setFailed(true)}
      />
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
        <Expand
          aria-hidden="true"
          className="size-4 text-white opacity-0 group-hover:opacity-100"
        />
      </span>
    </button>
  )
}
