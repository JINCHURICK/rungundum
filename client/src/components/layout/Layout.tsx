import { useState, useCallback, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuthStore } from '@/store/auth'
import NotificationBell from '@/components/ui/NotificationBell'
import OfflineBanner from '@/components/ui/OfflineBanner'
import { useIdleTimer } from '@/hooks/useIdleTimer'
import { IdleWarningModal } from '@/components/IdleWarningModal'
import { api } from '@/lib/api'

export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [idleWarning, setIdleWarning] = useState(false)
  const { club, user, logout, viewingClub } = useAuthStore()
  const effectiveClub = viewingClub ?? club

  const handleIdle = useCallback(async () => {
    setIdleWarning(false)
    sessionStorage.setItem('logout-reason', 'A sessão expirou por inatividade (10 minutos).')
    try { await api.post('/auth/logout') } catch { /* já sem sessão */ }
    logout()
    window.location.href = '/login'
  }, [logout])

  useIdleTimer({
    onWarn: useCallback(() => setIdleWarning(true), []),
    onIdle: handleIdle,
    enabled: !!user,
  })

  // Verificação periódica de sessão — detecta invalidação por login noutro dispositivo
  // sem esperar que o access token expire (que levaria até 15 min)
  useEffect(() => {
    const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutos
    const id = setInterval(() => {
      api.get('/auth/me').catch(() => {
        // Se falhar com SESSION_TERMINATED, o interceptor do api.ts trata o logout e a mensagem
      })
    }, CHECK_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return (
    <>
    <IdleWarningModal
      open={idleWarning}
      onContinue={() => setIdleWarning(false)}
      onLogout={handleIdle}
    />
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar — desktop, sticky */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0 flex flex-col">
        <OfflineBanner />
        {/* Header mobile */}
        <header
          className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 flex items-center gap-3 px-4 h-14"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors -ml-1.5"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Menu size={22} />
          </button>
          {effectiveClub?.logoUrl ? (
            <img src={effectiveClub.logoUrl} alt={effectiveClub.name} className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {effectiveClub?.acronym?.slice(0, 2) ?? 'RM'}
            </div>
          )}
          <p className="font-semibold text-gray-900 text-sm truncate flex-1">{effectiveClub?.name ?? 'Rungundum'}</p>
          <NotificationBell />
          <Link to="/profile" className="flex-shrink-0">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user?.email ?? ''} className="w-9 h-9 rounded-full object-cover hover:opacity-80 transition-opacity" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors">
                {user?.email?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </Link>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto pb-8">
          <Outlet />
        </div>
      </div>
    </div>
    </>
  )
}
