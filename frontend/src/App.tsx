import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  ChevronRight,
  ClipboardList,
  Home,
  UserRound,
  LogOut,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Feedback, Spinner } from './components/ui/feedback'
import { LoginPage } from './auth/LoginPage'
import { RoleSwitcher } from './auth/RoleSwitcher'
import { useUserStore } from './stores/user.store'
import { roleLabels } from './types/user.types'
import { useWorkOrderStore } from './work-orders/stores/work-order.store'
import { WorkOrderListPage } from './work-orders/WorkOrderListPage'
import { WorkOrderDetailPage } from './work-orders/WorkOrderDetailPage'
import { cn } from './lib/utils'
import type { UserRole } from './types/user.types'

const sidebarThemes: Record<
  UserRole,
  {
    background: string
    navigation: string
    foreground: string
    divider: string
  }
> = {
  ADMIN: {
    background: 'from-[#359e90] to-[#60b4a2]',
    navigation: 'text-teal-900',
    foreground: 'text-white',
    divider: 'border-white/35',
  },
  SPV: {
    background: 'from-[#356eaf] to-[#659dd0]',
    navigation: 'text-blue-900',
    foreground: 'text-white',
    divider: 'border-white/35',
  },
  MECHANIC: {
    background: 'from-[#bc9b7b] to-[#d8bea3]',
    navigation: 'text-[#5b3d25]',
    foreground: 'text-[#49331f]',
    divider: 'border-[#755334]/30',
  },
}

function App() {
  return (
    <BrowserRouter>
      <AuthenticatedApp />
    </BrowserRouter>
  )
}
function AuthenticatedApp() {
  const [roleSwitchOpen, setRoleSwitchOpen] = useState(false)
  const location = useLocation()
  const { user, initialized, loading, error, initialize, logout, expire } =
    useUserStore()
  const { pending } = useWorkOrderStore()
  const role = user?.role ?? 'ADMIN'
  const sidebarTheme = sidebarThemes[role]
  useEffect(() => {
    void initialize()
  }, [initialize])
  useEffect(() => {
    window.addEventListener('tempopress:session-expired', expire)
    return () =>
      window.removeEventListener('tempopress:session-expired', expire)
  }, [expire])
  if (!initialized)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Memeriksa sesi..." />
      </div>
    )
  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="*"
          element={
            <Navigate to="/login" replace state={{ from: location.pathname }} />
          }
        />
      </Routes>
    )
  const requestedPath = (location.state as { from?: string } | null)?.from
  const returnPath = requestedPath?.startsWith('/work-orders')
    ? requestedPath
    : '/work-orders'

  return (
    <>
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 text-sm font-semibold shadow focus:translate-y-0"
      >
        Lewati ke konten
      </a>
      <aside
        aria-label="Sidebar Work Order"
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-linear-to-b px-4 py-8 transition-colors lg:flex',
          sidebarTheme.background,
          sidebarTheme.foreground,
        )}
      >
        <Link
          to="/work-orders"
          onClick={(event) => {
            if (pending) event.preventDefault()
          }}
          className="mb-14 flex items-center gap-3 px-2"
        >
          <img
            src="/brand/tempopress-logo.png"
            alt="Logo Tempopress"
            className="h-12 w-12 shrink-0 object-contain"
          />
          <div className={cn('min-w-0 border-l pl-3', sidebarTheme.divider)}>
            <p className="text-sm leading-snug font-bold">
              PT Tempopress International Delivery
            </p>
            <p className="mt-1.5 text-xs opacity-90">Technical Test</p>
          </div>
        </Link>
        <nav aria-label="Navigasi utama">
          <Link
            to="/work-orders"
            aria-current="page"
            onClick={(event) => {
              if (pending) event.preventDefault()
            }}
            className={cn(
              'flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3.5 text-sm font-semibold shadow-xs',
              sidebarTheme.navigation,
            )}
          >
            <ClipboardList className="size-5" aria-hidden="true" />
            Work Order
          </Link>
        </nav>
      </aside>
      <div className="min-h-screen lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2.5 text-sm">
            <img
              src="/brand/tempopress-logo.png"
              alt="Logo Tempopress"
              className="size-8 object-contain lg:hidden"
            />
            <Home
              className="hidden size-4 text-muted-foreground lg:block"
              aria-hidden="true"
            />
            <span className="hidden text-muted-foreground sm:inline">
              Operasional
            </span>
            <ChevronRight
              className="hidden size-3.5 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <span className="font-semibold">Work Order</span>
          </div>
          <div className="flex items-center gap-3">
            <UserRound
              className="hidden size-5 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <div className="min-w-40">
              <p aria-label="Pengguna aktif" className="text-sm font-semibold">
                {user.name} · {roleLabels[user.role]}
              </p>
              <RoleSwitcher
                disabled={pending}
                onDialogChange={setRoleSwitchOpen}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pending}
              onClick={() => {
                void logout()
              }}
            >
              <LogOut />
              Keluar
            </Button>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto max-w-400 px-5 py-8 sm:px-8 sm:py-10 xl:px-10"
        >
          {error && !roleSwitchOpen && (
            <Feedback className="mb-6">
              {error}
              <Button
                variant="outline"
                size="sm"
                className="ml-3"
                disabled={loading}
                onClick={() => {
                  void initialize()
                }}
              >
                Coba lagi
              </Button>
            </Feedback>
          )}
          <Routes>
            <Route
              path="/login"
              element={<Navigate to={returnPath} replace />}
            />
            <Route path="/" element={<Navigate to="/work-orders" replace />} />
            <Route path="/work-orders" element={<WorkOrderListPage />}>
              <Route path=":workOrderId" element={<WorkOrderDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/work-orders" replace />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App
