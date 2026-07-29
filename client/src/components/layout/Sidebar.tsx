import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Map, Settings, LogOut, ChevronRight, BarChart2, UserCircle, Wallet, CreditCard, Shield, Gavel, MessageSquare, TrendingUp, Megaphone, Crown } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { can } from '@/lib/permissions'
import { cn, getUserRoleLabel } from '@/lib/utils'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import NotificationBell from '@/components/ui/NotificationBell'

interface Props {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: Props) {
  const { club, user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const role = user?.role
  const isPlatformAdmin = user?.platformAdmin === true

  const navItems = [
    { to: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard',        show: true },
    { to: '/raids',                  icon: Map,             label: 'Raids',            show: true },
    { to: '/members',                icon: Users,           label: 'Membros',          show: can(role, 'MEMBERS_READ') },
    { to: '/quotas',                 icon: Wallet,          label: 'Quotas',           show: can(role, 'QUOTAS') },
    { to: '/treasury',               icon: TrendingUp,      label: 'Tesouraria',       show: can(role, 'TREASURY') },
    { to: '/disciplinary',           icon: Gavel,           label: 'Disciplinar',      show: can(role, 'DISCIPLINARY') },
    { to: '/announcements',          icon: Megaphone,       label: 'Comunicados',      show: can(role, 'ANNOUNCEMENTS_READ') },
    { to: '/positions',              icon: Crown,           label: 'Órgãos e Cargos', show: can(role, 'POSITIONS_READ') },
    { to: '/sms',                    icon: MessageSquare,   label: 'SMS',              show: can(role, 'SMS') },
    { to: '/stats',                  icon: BarChart2,       label: 'Estatísticas',     show: can(role, 'STATS') },
    { to: '/settings/subscription',  icon: CreditCard,      label: 'Subscrição',       show: can(role, 'SUBSCRIPTIONS') },
    { to: '/club',                   icon: Settings,        label: 'Configurações',    show: can(role, 'CLUB_CONFIG') },
    { to: '/profile',                icon: UserCircle,      label: 'O meu Perfil',     show: true },
    ...(isPlatformAdmin ? [
      { to: '/platform-admin', icon: Shield, label: 'Admin Plataforma', show: true },
    ] : []),
  ].filter(i => i.show)

  async function handleLogout() {
    try {
      await api.post('/auth/logout', { refreshToken })
    } catch {}
    logout()
    navigate('/login')
    toast.success('Sessão terminada')
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo + Club */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {club?.logoUrl ? (
            <img src={club.logoUrl} alt={club.name} className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: 'var(--accent)' }}>
              {club?.acronym?.slice(0, 2) ?? 'RG'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate text-sm">{club?.name ?? 'Rungundum'}</p>
            <p className="text-xs text-gray-500">{club?.acronym}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )
            }
            style={({ isActive }) => isActive ? { backgroundColor: 'var(--accent)' } : {}}
          >
            {({ isActive }) => (
              <>
                <Icon size={19} className="flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {!isActive && <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="flex-shrink-0">
            {user?.photoUrl ? (
              <img src={user.photoUrl} alt={user.email} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
                {user?.email?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.email}</p>
            <p className="text-xs text-gray-400">{getUserRoleLabel(role)}</p>
          </div>
          <span className="hidden lg:block"><NotificationBell /></span>
        </div>
        <button
          onClick={() => { handleLogout(); onNavigate?.() }}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={16} />
          Terminar Sessão
        </button>
      </div>
    </aside>
  )
}
