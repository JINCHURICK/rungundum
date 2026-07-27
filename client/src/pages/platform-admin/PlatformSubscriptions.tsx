import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatShortDate } from '@/lib/utils'
import { Search, AlertTriangle, Clock, CheckCircle, XCircle, ArrowRight, Filter } from 'lucide-react'

const PLAN_OPTIONS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const
const STATUS_OPTIONS = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' }
const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-gray-100 text-gray-700', STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-purple-100 text-purple-700', ENTERPRISE: 'bg-amber-100 text-amber-700',
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL:    { label: 'Trial',     color: 'bg-blue-100 text-blue-700' },
  ACTIVE:   { label: 'Activo',   color: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'Vencido',  color: 'bg-amber-100 text-amber-700' },
  CANCELLED:{ label: 'Cancelado',color: 'bg-red-100 text-red-700' },
  EXPIRED:  { label: 'Expirado', color: 'bg-gray-100 text-gray-600' },
}

interface Club {
  id: string; name: string; acronym: string; location: string
  plan: string; planStatus: string; planLabel: string
  trialEndsAt: string | null; planExpiresAt: string | null; trialDaysLeft: number | null
  createdAt: string; membersCount: number; raidsCount: number
}

interface EditForm { plan: string; planStatus: string; trialEndsAt: string; planExpiresAt: string }

function planExpiringDays(c: Club) {
  if (!c.planExpiresAt) return null
  return Math.ceil((new Date(c.planExpiresAt).getTime() - Date.now()) / 86400000)
}

const QUICK_FILTERS = [
  { key: 'all',         label: 'Todos',               fn: (_: Club) => true },
  { key: 'trial',       label: 'Em Trial',             fn: (c: Club) => c.planStatus === 'TRIAL' },
  { key: 'expiring',    label: 'Trial a expirar',      fn: (c: Club) => c.planStatus === 'TRIAL' && (c.trialDaysLeft ?? 99) <= 7 },
  { key: 'active',      label: 'Activos',              fn: (c: Club) => c.planStatus === 'ACTIVE' },
  { key: 'planexpiring',label: 'Plano a expirar (30d)',fn: (c: Club) => c.planStatus === 'ACTIVE' && (planExpiringDays(c) ?? 999) <= 30 && (planExpiringDays(c) ?? 999) >= 0 },
  { key: 'problem',     label: 'Com problemas',        fn: (c: Club) => ['PAST_DUE', 'CANCELLED', 'EXPIRED'].includes(c.planStatus) },
  { key: 'paid',        label: 'Planos pagos',         fn: (c: Club) => ['STARTER', 'PRO', 'ENTERPRISE'].includes(c.plan) && c.planStatus === 'ACTIVE' },
]

export default function PlatformSubscriptions() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState('all')
  const [editing, setEditing] = useState<Club | null>(null)
  const [form, setForm] = useState<EditForm>({ plan: '', planStatus: '', trialEndsAt: '', planExpiresAt: '' })

  const { data: clubs = [], isLoading } = useQuery<Club[]>({
    queryKey: ['platform-admin-clubs'],
    queryFn: () => api.get('/platform-admin/clubs').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditForm> }) =>
      api.patch(`/platform-admin/clubs/${id}/subscription`, {
        plan: data.plan,
        planStatus: data.planStatus,
        trialEndsAt: data.trialEndsAt || null,
        planExpiresAt: data.planExpiresAt || null,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Subscrição actualizada!')
      queryClient.invalidateQueries({ queryKey: ['platform-admin-clubs'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      setEditing(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao actualizar'),
  })

  function openEdit(club: Club) {
    setEditing(club)
    setForm({
      plan: club.plan,
      planStatus: club.planStatus,
      trialEndsAt: club.trialEndsAt ? club.trialEndsAt.slice(0, 10) : '',
      planExpiresAt: club.planExpiresAt ? club.planExpiresAt.slice(0, 10) : '',
    })
  }

  const qf = QUICK_FILTERS.find((f) => f.key === quickFilter) ?? QUICK_FILTERS[0]
  const filtered = clubs
    .filter(qf.fn)
    .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.location.toLowerCase().includes(search.toLowerCase()))

  // Summary stats
  const trialCount = clubs.filter((c) => c.planStatus === 'TRIAL').length
  const expiringCount = clubs.filter((c) => c.planStatus === 'TRIAL' && (c.trialDaysLeft ?? 99) <= 7).length
  const activeCount = clubs.filter((c) => c.planStatus === 'ACTIVE').length
  const problemCount = clubs.filter((c) => ['PAST_DUE', 'CANCELLED', 'EXPIRED'].includes(c.planStatus)).length

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscrições</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão centralizada dos planos de todos os clubes</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Em Trial', value: trialCount, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Trial a expirar (7d)', value: expiringCount, icon: AlertTriangle, color: expiringCount > 0 ? 'text-amber-600' : 'text-gray-400', bg: expiringCount > 0 ? 'bg-amber-50' : 'bg-gray-50' },
          { label: 'Activos', value: activeCount, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Com problemas', value: problemCount, icon: XCircle, color: problemCount > 0 ? 'text-red-600' : 'text-gray-400', bg: problemCount > 0 ? 'bg-red-50' : 'bg-gray-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3">
              <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon size={14} className={color} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 w-52"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setQuickFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                quickFilter === f.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${quickFilter === f.key ? 'bg-white/20' : 'bg-gray-100'}`}>
                  {clubs.filter(f.fn).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-0 pb-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full border-t-red-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="py-3 text-left font-semibold">Clube</th>
                    <th className="py-3 text-left font-semibold">Plano actual</th>
                    <th className="py-3 text-left font-semibold">Estado</th>
                    <th className="py-3 text-left font-semibold">Trial termina</th>
                    <th className="py-3 text-left font-semibold">Plano expira</th>
                    <th className="py-3 text-center font-semibold">Membros</th>
                    <th className="py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((club) => {
                    const statusInfo = STATUS_LABELS[club.planStatus] ?? STATUS_LABELS.ACTIVE
                    const isExpiringSoon = club.planStatus === 'TRIAL' && (club.trialDaysLeft ?? 99) <= 7
                    return (
                      <tr key={club.id} className={`hover:bg-gray-50 transition-colors ${isExpiringSoon ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-gray-600">{club.acronym?.slice(0, 2)}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 leading-tight">{club.name}</p>
                              <p className="text-xs text-gray-400">{club.location} · {club.membersCount} membros</p>
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
                          {isExpiringSoon && (
                            <p className="text-xs text-amber-600 font-medium mt-0.5 flex items-center gap-1">
                              <AlertTriangle size={11} /> {club.trialDaysLeft}d
                            </p>
                          )}
                          {club.planStatus === 'TRIAL' && !isExpiringSoon && club.trialDaysLeft !== null && (
                            <p className="text-xs text-gray-400 mt-0.5">{club.trialDaysLeft}d restantes</p>
                          )}
                        </td>
                        <td className="py-3.5 text-sm text-gray-600">
                          {club.trialEndsAt ? formatShortDate(club.trialEndsAt) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 text-sm text-gray-600">
                          {club.planExpiresAt ? formatShortDate(club.planExpiresAt) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3.5 text-center font-medium text-gray-700">{club.membersCount}</td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <Button size="sm" onClick={() => openEdit(club)}>
                              Editar plano
                            </Button>
                            <Link
                              to={`/platform-admin/clubs/${club.id}`}
                              className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                              title="Ver detalhe do clube"
                            >
                              <ArrowRight size={15} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                        {clubs.length === 0 ? 'Nenhum clube registado.' : 'Nenhum clube corresponde a este filtro.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Editar plano — ${editing.name}` : ''}>
        {editing && (
          <div className="space-y-4">
            {/* Current state summary */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[editing.plan]}`}>
                {PLAN_LABELS[editing.plan]}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_LABELS[editing.planStatus]?.color}`}>
                {STATUS_LABELS[editing.planStatus]?.label}
              </span>
              {editing.trialDaysLeft !== null && (
                <span className="text-xs text-gray-500">{editing.trialDaysLeft} dias de trial restantes</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                <select
                  value={form.planStatus}
                  onChange={(e) => setForm((f) => ({ ...f, planStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Trial termina em"
                type="date"
                value={form.trialEndsAt}
                onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
              />
              <Input
                label="Plano expira em"
                type="date"
                value={form.planExpiresAt}
                onChange={(e) => setForm((f) => ({ ...f, planExpiresAt: e.target.value }))}
              />
            </div>

            {/* Quick actions */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500">Reactivar por período</p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { label: '1 mês', months: 1 },
                  { label: '3 meses', months: 3 },
                  { label: '6 meses', months: 6 },
                  { label: '1 ano', months: 12 },
                  { label: '2 anos', months: 24 },
                ].map(({ label, months }) => {
                  const expiry = new Date()
                  expiry.setMonth(expiry.getMonth() + months)
                  return (
                    <button
                      key={months}
                      onClick={() => setForm((f) => ({ ...f, planStatus: 'ACTIVE', planExpiresAt: expiry.toISOString().slice(0, 10) }))}
                      className="px-2 py-2 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200 transition-colors text-center"
                    >
                      +{label}
                    </button>
                  )
                })}
              </div>

              <p className="text-xs font-medium text-gray-500 pt-1">Acções de plano</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const d = new Date(); d.setFullYear(d.getFullYear() + 1)
                    setForm((f) => ({ ...f, plan: 'PRO', planStatus: 'ACTIVE', planExpiresAt: d.toISOString().slice(0, 10) }))
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
                >
                  Activar PRO 1 ano
                </button>
                <button
                  onClick={() => {
                    const d = new Date(); d.setFullYear(d.getFullYear() + 1)
                    setForm((f) => ({ ...f, plan: 'STARTER', planStatus: 'ACTIVE', planExpiresAt: d.toISOString().slice(0, 10) }))
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  Activar Starter 1 ano
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, plan: 'FREE', planStatus: 'ACTIVE', trialEndsAt: '', planExpiresAt: '' }))}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
                >
                  Reverter para Gratuito
                </button>
                <button
                  onClick={() => {
                    const d = new Date(); d.setDate(d.getDate() + 30)
                    setForm((f) => ({ ...f, planStatus: 'TRIAL', trialEndsAt: d.toISOString().slice(0, 10) }))
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 border border-sky-200 transition-colors"
                >
                  Estender trial +30 dias
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                onClick={() => updateMutation.mutate({ id: editing.id, data: form })}
                loading={updateMutation.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
