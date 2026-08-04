import { useState, useCallback } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, CreditCard, LogOut, Menu, X, ChevronLeft, Bell, Settings2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { IdleWarningModal } from '@/components/IdleWarningModal'

const navItems = [
  { to: '/platform-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/platform-admin/clubs', icon: Building2, label: 'Clubes' },
  { to: '/platform-admin/subscriptions', icon: CreditCard, label: 'Subscrições' },
  { to: '/platform-admin/requests', icon: Bell, label: 'Pedidos' },
  { to: '/platform-admin/plans', icon: Settings2, label: 'Planos' },
]

function PlatformSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await api.post('/auth/logout', { refreshToken }) } catch {}
    logout()
    navigate('/login')
    toast.success('Sessão terminada')
  }

  return (
    <aside className="w-60 bg-gray-950 flex flex-col h-screen">
      {/* Branding */}
      <div className="px-5 py-4 border-b border-gray-800">
        <div className="flex flex-col gap-0.5">
          <img src="/logo-preto.png" alt="Rungundum" className="h-26 w-auto" />
          <p className="text-xs text-gray-500 leading-tight pl-0.5">Painel Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              )
            }
          >
            {() => (
              <>
                <Icon size={17} className="flex-shrink-0" />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 space-y-1">
        <p className="text-xs text-gray-600 truncate px-3 py-1">{user?.email}</p>
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-all"
        >
          <ChevronLeft size={15} />
          Voltar ao clube
        </Link>
        <button
          onClick={() => { handleLogout(); onNavigate?.() }}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-red-900/40 hover:text-red-400 transition-all"
        >
          <LogOut size={15} />
          Terminar sessão
        </button>
      </div>
    </aside>
  )
}

export default function PlatformLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [idleWarning, setIdleWarning] = useState(false)
  const { user, logout } = useAuthStore()

  const handleIdle = useCallback(async () => {
    setIdleWarning(false)
    sessionStorage.setItem('logout-reason', 'A sessão expirou por inatividade (10 minutos).')
    try { await api.post('/auth/logout') } catch {}
    logout()
    window.location.href = '/login'
  }, [logout])

  useIdleTimer({
    onWarn: useCallback(() => setIdleWarning(true), []),
    onIdle: handleIdle,
    enabled: !!user,
  })

  return (
    <>
    <IdleWarningModal
      open={idleWarning}
      onContinue={() => setIdleWarning(false)}
      onLogout={handleIdle}
    />
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar desktop */}
      <div className="hidden lg:block flex-shrink-0">
        <div className="sticky top-0 h-screen">
          <PlatformSidebar />
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-60 h-full shadow-2xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-white z-10"
            >
              <X size={18} />
            </button>
            <PlatformSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-gray-950 border-b border-gray-800 flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-white transition-colors -ml-1"
          >
            <Menu size={20} />
          </button>
          <img src="/logo-preto.png" alt="Rungundum" className="h-20 w-auto" />
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto pb-8">
          <Outlet />
        </div>
      </div>
    </div>
    </>
  )
}
