import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog'
import { Input, Select } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Feedback, FieldMessage, Spinner } from '../components/ui/feedback'
import { useUserStore } from '../stores/user.store'
import { useFormValidation } from '../lib/use-form-validation'
import { roleLabels } from '../types/user.types'
import type { UserRole } from '../types/user.types'

export function RoleSwitcher({
  disabled,
  onDialogChange,
}: {
  disabled: boolean
  onDialogChange: (open: boolean) => void
}) {
  const { user, loading, clearError } = useUserStore()
  const [target, setTarget] = useState<UserRole | null>(null)
  const navigate = useNavigate()
  useEffect(() => () => onDialogChange(false), [onDialogChange])
  function close() {
    if (!loading) {
      setTarget(null)
      clearError()
      onDialogChange(false)
    }
  }
  if (!user) return null
  return (
    <>
      <label htmlFor="role-switcher" className="sr-only">
        Ganti role
      </label>
      <Select
        id="role-switcher"
        className="mt-1 h-8 text-xs"
        value={user.role}
        disabled={disabled || loading}
        onChange={(event) => {
          const role = event.target.value as UserRole
          if (role !== user.role) {
            clearError()
            setTarget(role)
            onDialogChange(true)
          }
        }}
      >
        {Object.entries(roleLabels).map(([role, label]) => (
          <option key={role} value={role}>
            {label}
          </option>
        ))}
      </Select>
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent
          busy={loading}
          className="max-w-md"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <header className="border-b px-6 py-5 pr-14">
            <DialogTitle className="text-lg font-bold">
              Login sebagai {target ? roleLabels[target] : ''}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Masukkan kredensial akun tujuan. Jika login gagal atau dibatalkan,
              akun Anda saat ini tetap aktif.
            </DialogDescription>
          </header>
          {target && (
            <SwitchLoginForm
              key={target}
              role={target}
              onCancel={close}
              onSuccess={() => {
                setTarget(null)
                clearError()
                onDialogChange(false)
                void navigate('/work-orders', { replace: true })
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
function SwitchLoginForm({
  role,
  onCancel,
  onSuccess,
}: {
  role: UserRole
  onCancel: () => void
  onSuccess: () => void
}) {
  const [username, setUsername] = useState(
    role === 'ADMIN' ? 'admin' : role === 'SPV' ? 'spv' : 'mekanik',
  )
  const [password, setPassword] = useState('')
  const { switchAccount, loading, error } = useUserStore()
  const validation = useFormValidation()
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (
          loading ||
          !validation.report({
            ...(!username.trim()
              ? { 'switch-username': 'Username wajib diisi.' }
              : {}),
            ...(!password
              ? { 'switch-password': 'Password wajib diisi.' }
              : {}),
          })
        )
          return
        void switchAccount(username, password, role).then((success) => {
          if (success) onSuccess()
        })
      }}
    >
      <div className="space-y-4 overflow-y-auto px-6 py-5">
        <div>
          <label
            htmlFor="switch-username"
            className="mb-1.5 block text-sm font-medium"
          >
            Username
          </label>
          <Input
            id="switch-username"
            value={username}
            maxLength={64}
            autoComplete="username"
            disabled={loading}
            {...validation.fieldProps('switch-username')}
            onChange={(event) => {
              setUsername(event.target.value)
              validation.clear('switch-username')
            }}
          />
          <FieldMessage
            id="switch-username"
            message={validation.inlineMessage('switch-username')}
          />
        </div>
        <div>
          <label
            htmlFor="switch-password"
            className="mb-1.5 block text-sm font-medium"
          >
            Password
          </label>
          <Input
            id="switch-password"
            type="password"
            value={password}
            maxLength={256}
            autoComplete="current-password"
            disabled={loading}
            {...validation.fieldProps('switch-password')}
            onChange={(event) => {
              setPassword(event.target.value)
              validation.clear('switch-password')
            }}
          />
          <FieldMessage
            id="switch-password"
            message={validation.inlineMessage('switch-password')}
          />
        </div>
        {validation.generalMessage && (
          <Feedback>{validation.generalMessage}</Feedback>
        )}
        {error && <Feedback>{error}</Feedback>}
      </div>
      <footer className="flex justify-end gap-3 border-t px-6 py-4">
        <Button variant="outline" disabled={loading} onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <Spinner label="Memproses..." />
          ) : (
            <>
              <LogIn />
              Login
            </>
          )}
        </Button>
      </footer>
    </form>
  )
}
