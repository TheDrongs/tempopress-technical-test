import { CheckCircle2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog'

export function ActionSuccessDialog({
  open,
  title,
  onClose,
}: {
  open: boolean
  title: string
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="max-w-sm items-center px-6 py-8 text-center"
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <span className="mb-5 rounded-full border border-emerald-200 bg-emerald-50 p-4 text-primary">
          <CheckCircle2 aria-hidden="true" className="size-9" />
        </span>
        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tutup popup ini untuk kembali ke daftar Work Order.
        </DialogDescription>
        <Button className="mt-6 w-full" onClick={onClose}>
          Tutup
        </Button>
      </DialogContent>
    </Dialog>
  )
}
