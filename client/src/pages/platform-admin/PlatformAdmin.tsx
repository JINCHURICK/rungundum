import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { formatShortDate } from '@/lib/utils'
import { Shield, Users, Map, Calendar, ChevronDown } from 'lucide-react'

const PLAN_OPTIONS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const
const STATUS_OPTIONS = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise',
}
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  TRIAL:    { label: 'Trial',       color: 'bg-blue-100 text-blue-700' },
  ACTIVE:   { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'Vencido',     color: 'bg-amber-100 text-amber-700' },
  CANCELLED:{ label: 'Cancelado',   color: 'bg-red-100 text-red-700' },
  EXPIRED:  { label: 'Expirado',    color: 'bg-gray-100 text-gray-600' },
}

interface Club {
  id: string
  name: string
  acronym: string
  location: string
  plan: string
  planStatus: string
  planLabel: string
  trialEndsAt: string | null
  planExpiresAt: string | null
  trialDaysLeft: number | null
  createdAt: string
  membersCount: number
  raidsCount: number
}

interface EditState {
  plan: string
  planStatus: string
  trialEndsAt: string
  planExpiresAt: string
}

export default function PlatformAdmin() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Club | null>(null)
  const [form, setForm] = useState<EditState>({ plan: '', planStatus: '', trialEndsAt: '', planExpiresAt: '' })

  const { data: clubs = [], isLoading } = useQuery<Club[]>({
    queryKey: ['platform-admin-clubs'],
    queryFn: () => api.get('/platform-admin/clubs').then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['platform-admin-stats'],
    queryFn: () => api.get('/platform-admin/stats').then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditState> }) =>
      api.patch(`/platform-admin/clubs/${id}/subscription`, data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Subscrição actualizada!')
      queryClient.invalidateQueries({ queryKey: ['platform-admin-clubs'] })
      queryClient.invalidateQueries({ queryKey: ['platform-admin-stats'] })
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

  function saveEdit() {
    if (!editing) return
    updateMutation.mutate({
      id: editing.id,
      data: {
        plan: form.plan,
        planStatus: form.planStatus,
        trialEndsAt: form.trialEndsAt || null,
        planExpiresAt: form.planExpiresAt || null,
      } as any,
    })
  }

  const totalClubs = stats?.totalClubs ?? clubs.length
  const activeClubs = clubs.filter((c) => c.planStatus === 'ACTIVE').length
  const trialClubs = clubs.filter((c) => c.planStatus === 'TRIAL').length

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
          <Shield size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-sm text-gray-500">Gestão de clubes e subscrições da plataforma</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total clubes', value: totalClubs, icon: <Shield size={15} />, color: 'text-gray-600' },
          { label: 'Activos', value: activeClubs, icon: <Users size={15} />, color: 'text-green-600' },
          { label: 'Em trial', value: trialClubs, icon: <Calendar size={15} />, color: 'text-blue-600' },
          { label: 'Pro / Enterprise', value: clubs.filter((c) => ['PRO', 'ENTERPRISE'].includes(c.plan) && c.planStatus === 'ACTIVE').length, icon: <Map size={15} />, color: 'text-purple-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-3 pb-3">
              <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${s.color}`}>
                {s.icon} {s.label}
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clubs table */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Clubes registados</h3>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-3 text-left pl-4 sm:pl-0">Clube</th>
                    <th className="pb-3 text-left">Plano</th>
                    <th className="pb-3 text-left">Estado</th>
                    <th className="pb-3 text-center">Membros</th>
                    <th className="pb-3 text-center">Raids</th>
                    <th className="pb-3 text-left">Trial / Expira</th>
                    <th className="pb-3 text-left">Criado</th>
                    <th className="pb-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {clubs.map((club) => {
                    const statusInfo = STATUS_LABELS[club.planStatus] ?? STATUS_LABELS.ACTIVE
                    return (
                      <tr key={club.id} className="hover:bg-gray-50">
                        <td className="py-3 pl-4 sm:pl-0">
                          <p className="font-semibold text-gray-900">{club.name}</p>
                          <p className="text-xs text-gray-400">{club.location}</p>
                        </td>
                        <td className="py-3">
                          <span className="font-medium">{PLAN_LABELS[club.plan] ?? club.plan}</span>
                        </td>
                        <td className="py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                          {club.planStatus === 'TRIAL' && club.trialDaysLeft !== null && (
                            <p className="text-xs text-gray-400 mt-0.5">{club.trialDaysLeft}d restantes</p>
                          )}
                        </td>
                        <td className="py-3 text-center text-gray-700">{club.membersCount}</td>
                        <td className="py-3 text-center text-gray-700">{club.raidsCount}</td>
                        <td className="py-3 text-xs text-gray-500">
                          {club.trialEndsAt && <p>Trial: {formatShortDate(club.trialEndsAt)}</p>}
                          {club.planExpiresAt && <p>Expira: {formatShortDate(club.planExpiresAt)}</p>}
                          {!club.trialEndsAt && !club.planExpiresAt && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 text-xs text-gray-400">{formatShortDate(club.createdAt)}</td>
                        <td className="py-3 pr-4 sm:pr-0 text-right">
                          <Button size="sm" variant="secondary" onClick={() => openEdit(club)}>
                            <ChevronDown size={13} />
                            Gerir
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                  {clubs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-gray-400 text-sm">Nenhum clube registado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Gerir — ${editing?.name}`}>
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={form.planStatus}
                  onChange={(e) => setForm((f) => ({ ...f, planStatus: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
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
            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
              <p><strong>Membros activos:</strong> {editing.membersCount}</p>
              <p><strong>Total raids:</strong> {editing.raidsCount}</p>
              <p><strong>Registado:</strong> {formatShortDate(editing.createdAt)}</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={saveEdit} loading={updateMutation.isPending}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
