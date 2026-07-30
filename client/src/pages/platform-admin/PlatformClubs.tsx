import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { formatShortDate } from '@/lib/utils'
import { Search, ArrowRight, ChevronDown, ChevronUp, LogIn } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

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

type SortKey = 'name' | 'createdAt' | 'membersCount' | 'raidsCount'

interface Club {
  id: string; name: string; acronym: string; location: string; country: string
  plan: string; planStatus: string; planLabel: string
  trialEndsAt: string | null; planExpiresAt: string | null; trialDaysLeft: number | null
  createdAt: string; membersCount: number; raidsCount: number
  accentColor: string; logoUrl: string | null
}

export default function PlatformClubs() {
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { setViewingClub } = useAuthStore()
  const navigate = useNavigate()

  const { data: clubs = [], isLoading } = useQuery<Club[]>({
    queryKey: ['platform-admin-clubs'],
    queryFn: () => api.get('/platform-admin/clubs').then((r) => r.data),
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : <ChevronDown size={12} className="opacity-30" />

  const filtered = useMemo(() => {
    let list = clubs
    if (search) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase()))
    if (filterPlan) list = list.filter((c) => c.plan === filterPlan)
    if (filterStatus) list = list.filter((c) => c.planStatus === filterStatus)
    return [...list].sort((a, b) => {
      let av: any = a[sortKey], bv: any = b[sortKey]
      if (sortKey === 'createdAt') { av = new Date(av).getTime(); bv = new Date(bv).getTime() }
      if (sortKey === 'name') { av = av?.toLowerCase(); bv = bv?.toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [clubs, search, filterPlan, filterStatus, sortKey, sortDir])

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clubes</h1>
        <p className="text-sm text-gray-500 mt-0.5">{clubs.length} clube{clubs.length !== 1 ? 's' : ''} registado{clubs.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar clube ou localidade..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              />
            </div>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="">Todos os planos</option>
              {['FREE', 'STARTER', 'PRO', 'ENTERPRISE'].map((p) => (
                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
            >
              <option value="">Todos os estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-0 pb-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full border-t-red-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-3 text-left font-semibold">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-800">
                        Clube <SortIcon k="name" />
                      </button>
                    </th>
                    <th className="py-3 text-left font-semibold">Plano</th>
                    <th className="py-3 text-left font-semibold">Estado</th>
                    <th className="py-3 text-center font-semibold">
                      <button onClick={() => toggleSort('membersCount')} className="flex items-center gap-1 mx-auto hover:text-gray-800">
                        Membros <SortIcon k="membersCount" />
                      </button>
                    </th>
                    <th className="py-3 text-center font-semibold">
                      <button onClick={() => toggleSort('raidsCount')} className="flex items-center gap-1 mx-auto hover:text-gray-800">
                        Raids <SortIcon k="raidsCount" />
                      </button>
                    </th>
                    <th className="py-3 text-left font-semibold">Trial / Expira</th>
                    <th className="py-3 text-left font-semibold">
                      <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-gray-800">
                        Registado <SortIcon k="createdAt" />
                      </button>
                    </th>
                    <th className="py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((club) => {
                    const statusInfo = STATUS_LABELS[club.planStatus] ?? STATUS_LABELS.ACTIVE
                    return (
                      <tr key={club.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-gray-600">{club.acronym?.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 leading-tight">{club.name}</p>
                              <p className="text-xs text-gray-400">{club.location}, {club.country}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[club.plan]}`}>
                            {PLAN_LABELS[club.plan] ?? club.plan}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {club.planStatus === 'TRIAL' && club.trialDaysLeft !== null && (
                            <p className="text-xs text-gray-400 mt-0.5">{club.trialDaysLeft}d restantes</p>
                          )}
                        </td>
                        <td className="py-3.5 text-center font-medium text-gray-700">{club.membersCount}</td>
                        <td className="py-3.5 text-center font-medium text-gray-700">{club.raidsCount}</td>
                        <td className="py-3.5 text-xs text-gray-500">
                          {club.trialEndsAt && <p>Trial: {formatShortDate(club.trialEndsAt)}</p>}
                          {club.planExpiresAt && <p>Expira: {formatShortDate(club.planExpiresAt)}</p>}
                          {!club.trialEndsAt && !club.planExpiresAt && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 text-xs text-gray-400">{formatShortDate(club.createdAt)}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <Link
                              to={`/platform-admin/clubs/${club.id}`}
                              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              Detalhes <ArrowRight size={12} />
                            </Link>
                            <button
                              onClick={() => {
                                setViewingClub({
                                  id: club.id,
                                  name: club.name,
                                  acronym: club.acronym,
                                  accentColor: club.accentColor ?? '#dc2626',
                                  logoUrl: club.logoUrl,
                                })
                                navigate('/dashboard')
                              }}
                              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                            >
                              Aceder <LogIn size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                        {clubs.length === 0 ? 'Nenhum clube registado.' : 'Nenhum clube corresponde aos filtros.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
