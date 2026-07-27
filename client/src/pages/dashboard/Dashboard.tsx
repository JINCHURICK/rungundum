import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Map, Users, TrendingUp, Plus, ArrowRight, Calendar, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { can } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { RaidStatusBadge } from '@/components/ui/Badge'
import { formatShortDate } from '@/lib/utils'

export default function Dashboard() {
  const { club, user } = useAuthStore()

  const { data: raids = [] } = useQuery({
    queryKey: ['raids'],
    queryFn: () => api.get('/raids').then((r) => r.data),
  })

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then((r) => r.data),
  })

  const isAdmin = can(user?.role, 'RAIDS_WRITE')

  const { data: subData } = useQuery({
    queryKey: ['subscription-current'],
    queryFn:  () => api.get('/subscriptions/current').then(r => r.data as any),
    enabled:  isAdmin,
  })

  const upcomingRaids = raids.filter((r: any) => ['CONFIRMED', 'IN_PROGRESS'].includes(r.status))
  const completedRaids = raids.filter((r: any) => r.status === 'COMPLETED')
  const activeMembers = members.filter((m: any) => m.status === 'ACTIVE')
  const subLimit   = subData?.memberLimit as number | null | undefined
  const subUsage   = subData?.usagePercent as number | undefined
  const subPlan    = subData?.subscription?.plan?.name as string | undefined
  const nearLimit  = subLimit !== null && subLimit !== undefined && (subUsage ?? 0) >= 80
  const atLimit    = subLimit !== null && subLimit !== undefined && (subUsage ?? 0) >= 100

  const stats = [
    { label: 'Raids Realizados', value: completedRaids.length, icon: Map, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Membros Activos', value: activeMembers.length, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Agendados', value: upcomingRaids.length, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total de Raids', value: raids.length, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="fade-in space-y-5">
      {/* Welcome */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            Olá! <span style={{ color: 'var(--accent)' }}>{club?.name}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Resumo do clube</p>
        </div>
        {isAdmin && (
          <Link to="/raids/new" className="flex-shrink-0">
            <Button size="sm">
              <Plus size={15} />
              Novo Raid
            </Button>
          </Link>
        )}
      </div>

      {/* Aviso de limite de membros */}
      {isAdmin && (nearLimit || atLimit) && subLimit !== null && (
        <Link to="/settings/subscription">
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${atLimit ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <AlertTriangle size={18} className={atLimit ? 'text-red-500 flex-shrink-0' : 'text-amber-500 flex-shrink-0'} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${atLimit ? 'text-red-700' : 'text-amber-700'}`}>
                {atLimit ? 'Limite de membros atingido' : `A ${subUsage}% da capacidade do plano ${subPlan ?? ''}`}
              </p>
              <p className={`text-xs mt-0.5 ${atLimit ? 'text-red-500' : 'text-amber-600'}`}>
                {atLimit
                  ? `Não podes adicionar mais membros. Faz upgrade para continuar a crescer.`
                  : `${activeMembers.length} de ${subLimit} membros activos. Considera fazer upgrade.`
                }
              </p>
              <div className="mt-2 w-full h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${atLimit ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(subUsage ?? 0, 100)}%` }}
                />
              </div>
            </div>
            <ArrowRight size={16} className={atLimit ? 'text-red-400 flex-shrink-0' : 'text-amber-400 flex-shrink-0'} />
          </div>
        </Link>
      )}

      {/* Stats — 2 colunas no mobile, 4 no desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming raids */}
      {upcomingRaids.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Próximos Raids</h2>
          <div className="space-y-2">
            {upcomingRaids.map((raid: any) => (
              <Link key={raid.id} to={`/raids/${raid.id}`}>
                <Card className="active:bg-gray-50 transition-colors">
                  <CardContent className="flex items-center gap-3 py-3.5 px-4">
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex flex-col items-center justify-center text-white text-xs font-bold leading-tight" style={{ backgroundColor: 'var(--accent)' }}>
                      <span className="text-sm font-bold">{new Date(raid.date).getDate()}</span>
                      <span className="text-xs opacity-80">{new Date(raid.date).toLocaleDateString('pt-AO', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{raid.title}</p>
                      <p className="text-xs text-gray-500 truncate">{raid.origin} → {raid.destination}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <RaidStatusBadge status={raid.status} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent raids */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Raids Recentes</h2>
          <Link to="/raids" className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {raids.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Map className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-4">Nenhum raid criado ainda.</p>
              {isAdmin && (
                <Link to="/raids/new">
                  <Button>Criar primeiro raid</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {raids.slice(0, 5).map((raid: any) => (
              <Link key={raid.id} to={`/raids/${raid.id}`}>
                <Card className="active:bg-gray-50 transition-colors">
                  <CardContent className="flex items-center gap-3 py-3.5 px-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm truncate">{raid.title}</p>
                        <RaidStatusBadge status={raid.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{formatShortDate(raid.date)} · {raid._count?.participants ?? 0} participantes</p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions — só admin */}
      {isAdmin && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Acções Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link to="/raids/new" className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl active:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                <Map size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Novo Raid</p>
                <p className="text-xs text-gray-500">Criar em 15 minutos</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-gray-300" />
            </Link>
            <Link to="/members" className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-2xl active:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Membros</p>
                <p className="text-xs text-gray-500">{activeMembers.length} activos</p>
              </div>
              <ArrowRight size={16} className="ml-auto text-gray-300" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
