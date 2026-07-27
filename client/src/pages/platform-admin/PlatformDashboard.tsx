import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { formatShortDate } from '@/lib/utils'
import { Building2, Users, Map, Clock, AlertTriangle, ArrowRight, Bell } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}
const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL:    { label: 'Trial',     color: 'bg-blue-100 text-blue-700' },
  ACTIVE:   { label: 'Activo',   color: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'Vencido',  color: 'bg-amber-100 text-amber-700' },
  CANCELLED:{ label: 'Cancelado',color: 'bg-red-100 text-red-700' },
  EXPIRED:  { label: 'Expirado', color: 'bg-gray-100 text-gray-600' },
}

export default function PlatformDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/platform-admin/stats').then((r) => r.data),
    refetchInterval: 60000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full border-t-red-600" />
      </div>
    )
  }

  const { totalClubs = 0, totalMembers = 0, totalRaids = 0, trialClubs = 0, expiringSoon = 0, pendingRequests = 0,
    planBreakdown = [], statusBreakdown = [], recentClubs = [] } = data ?? {}

  const metricCards = [
    { label: 'Total de Clubes', value: totalClubs, icon: Building2, color: 'text-gray-700', bg: 'bg-gray-100' },
    { label: 'Membros Activos', value: totalMembers, icon: Users, color: 'text-green-700', bg: 'bg-green-100' },
    { label: 'Total de Raids', value: totalRaids, icon: Map, color: 'text-blue-700', bg: 'bg-blue-100' },
    { label: 'Em Período Trial', value: trialClubs, icon: Clock, color: 'text-purple-700', bg: 'bg-purple-100' },
  ]

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Visão geral da plataforma Rungundum</p>
      </div>

      {/* Alert: pedidos pendentes */}
      {pendingRequests > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <Bell size={16} className="flex-shrink-0 text-red-500" />
          <span>
            <strong>{pendingRequests} pedido{pendingRequests > 1 ? 's' : ''}</strong> de upgrade pendente{pendingRequests > 1 ? 's' : ''}.
          </span>
          <Link to="/platform-admin/requests" className="ml-auto text-red-700 hover:underline font-medium flex items-center gap-1 flex-shrink-0">
            Ver pedidos <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Alert: trials a expirar */}
      {expiringSoon > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 text-amber-500" />
          <span>
            <strong>{expiringSoon} {expiringSoon === 1 ? 'clube' : 'clubes'}</strong> com trial a expirar nos próximos 7 dias.
          </span>
          <Link to="/platform-admin/subscriptions" className="ml-auto text-amber-700 hover:underline font-medium flex items-center gap-1 flex-shrink-0">
            Ver <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={17} className={color} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan breakdown */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Distribuição por Plano</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {(['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const).map((plan) => {
                const entry = planBreakdown.find((p: any) => p.plan === plan)
                const count = entry?.count ?? 0
                const pct = totalClubs > 0 ? Math.round((count / totalClubs) * 100) : 0
                return (
                  <div key={plan}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}>
                        {PLAN_LABELS[plan]}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{count} <span className="text-xs font-normal text-gray-400">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Estado das Subscrições</h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              {(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const).map((status) => {
                const entry = statusBreakdown.find((s: any) => s.status === status)
                const count = entry?.count ?? 0
                const { label, color } = STATUS_LABELS[status]
                return (
                  <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                    <span className="text-xl font-bold text-gray-900">{count}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent clubs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Clubes Recentes</h3>
            <Link to="/platform-admin/clubs" className="text-sm text-red-600 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-gray-50">
            {recentClubs.map((club: any) => {
              const statusInfo = STATUS_LABELS[club.planStatus] ?? STATUS_LABELS.ACTIVE
              return (
                <div key={club.id} className="py-3 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-600">{club.acronym?.slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{club.name}</p>
                    <p className="text-xs text-gray-400">{club.location} · {club.membersCount} membros</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[club.plan]}`}>
                      {PLAN_LABELS[club.plan]}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <Link to={`/platform-admin/clubs/${club.id}`} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                    <ArrowRight size={15} />
                  </Link>
                </div>
              )
            })}
            {recentClubs.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Nenhum clube registado ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
