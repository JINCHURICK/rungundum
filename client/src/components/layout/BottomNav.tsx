import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Map, Users, BarChart2, Settings, UserCircle, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BottomNav() {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(user?.role ?? '')

  async function handleLogout() {
    try { await api.post('/auth/logout', { refreshToken }) } catch {}
    logout()
    navigate('/login')
    toast.success('Sessão terminada')
  }

  const items = isAdmin
    ? [
        { to: '/', icon: LayoutDashboard, label: 'Início', end: true },
        { to: '/raids', icon: Map, label: 'Raids' },
        { to: '/members', icon: Users, label: 'Membros' },
        { to: '/stats', icon: BarChart2, label: 'Stats' },
        { to: '/club', icon: Settings, label: 'Config' },
      ]
    : [
        { to: '/', icon: LayoutDashboard, label: 'Início', end: true },
        { to: '/raids', icon: Map, label: 'Raids' },
        { to: '/profile', icon: UserCircle, label: 'Perfil' },
      ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-14">
        {items.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors',
                isActive ? '' : 'text-gray-400 hover:text-gray-600'
              )
            }
            style={({ isActive }) => isActive ? { color: 'var(--accent)' } : {}}
          >
            {({ isActive }) => (
              <>
                <div className={cn('p-1 rounded-lg transition-colors', isActive && 'bg-red-50')}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                </div>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Logout — only shown for non-admin (admin has Config which has logout context) */}
        {!isAdmin && (
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <div className="p-1 rounded-lg">
              <LogOut size={20} strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-medium leading-none">Sair</span>
          </button>
        )}
      </div>
    </nav>
  )
}
