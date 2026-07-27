import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Map, Users, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { RaidStatusBadge } from '@/components/ui/Badge'
import { getDifficultyLabel } from '@/lib/utils'

const STATUSES = [
  { value: '', label: 'Todos' },
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'IN_PROGRESS', label: 'Em Curso' },
  { value: 'COMPLETED', label: 'Concluído' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear()
  return [{ value: '', label: 'Todos os anos' }, ...Array.from({ length: 5 }, (_, i) => ({ value: String(current - i), label: String(current - i) }))]
})()

export default function RaidsList() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  const { data: raids = [], isLoading } = useQuery({
    queryKey: ['raids', search, statusFilter, yearFilter],
    queryFn: () => api.get('/raids', { params: { search: search || undefined, status: statusFilter || undefined, year: yearFilter || undefined } }).then((r) => r.data),
  })

  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(user?.role ?? '')

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Raids</h1>
          <p className="text-sm text-gray-500 mt-0.5">{raids.length} raids no arquivo</p>
        </div>
        {isAdmin && (
          <Link to="/raids/new" className="flex-shrink-0">
            <Button size="sm">
              <Plus size={15} />
              Novo
            </Button>
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar raids..."
          className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ fontSize: '16px' }}
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Status filter — horizontally scrollable on mobile */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none flex-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? 'text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
              style={statusFilter === s.value ? { backgroundColor: 'var(--accent)' } : {}}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* Year filter */}
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="flex-shrink-0 border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white text-gray-600 focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': 'var(--accent)' } as any}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y.value} value={y.value}>{y.label}</option>
          ))}
        </select>
      </div>

      {/* Raids list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : raids.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Map className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nenhum raid encontrado.</p>
            {isAdmin && (
              <Link to="/raids/new">
                <Button>Criar primeiro raid</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {raids.map((raid: any) => (
            <Link key={raid.id} to={`/raids/${raid.id}`}>
              <Card className="active:bg-gray-50 transition-colors">
                <CardContent className="flex items-center gap-3 py-3.5 px-4">
                  {/* Date pill */}
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center text-white text-xs font-bold leading-tight" style={{ backgroundColor: 'var(--accent)' }}>
                    <span className="text-sm font-bold">{new Date(raid.date).getDate()}</span>
                    <span className="text-xs opacity-80">{new Date(raid.date).toLocaleDateString('pt-AO', { month: 'short' })}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm truncate">{raid.title}</p>
                      <RaidStatusBadge status={raid.status} />
                    </div>
                    <p className="text-xs text-gray-500 truncate">{raid.origin} → {raid.destination}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{getDifficultyLabel(raid.difficulty)}{raid.estimatedKm ? ` · ${raid.estimatedKm} km` : ''}</p>
                  </div>

                  {/* Participants — hidden on very small screens */}
                  <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
                    <Users size={13} className="text-gray-400" />
                    <span>{raid._count?.participants ?? 0}</span>
                  </div>

                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
