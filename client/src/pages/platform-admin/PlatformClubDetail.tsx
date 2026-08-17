import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatShortDate } from '@/lib/utils'
import { ChevronLeft, MapPin, Globe, Users, Map, Calendar, CreditCard, CheckCircle, XCircle, Bell } from 'lucide-react'

type NotificationMode = 'BOTH' | 'SMS_ONLY' | 'EMAIL_ONLY' | 'NONE'

const NOTIFICATION_OPTIONS: { value: NotificationMode; label: string; desc: string }[] = [
  { value: 'BOTH',       label: 'SMS + Email',    desc: 'Envia ambos os canais de notificação' },
  { value: 'SMS_ONLY',   label: 'Apenas SMS',     desc: 'Só envia SMS, sem email' },
  { value: 'EMAIL_ONLY', label: 'Apenas Email',   desc: 'Só envia email, sem SMS' },
  { value: 'NONE',       label: 'Desactivado',    desc: 'Nenhuma notificação automática' },
]

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
const MEMBER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', SUSPENDED: 'Suspenso', GUEST: 'Convidado',
}
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador', APP_ADMIN: 'Adm. App', CAPTAIN: 'Capitão',
  VICE_PRESIDENT: 'Vice-Presidente', TREASURER: 'Tesoureiro', SECRETARY: 'Secretário',
  PR: 'Rel. Públicas', DISCIPLINA: 'Disciplina', MEMBER: 'Membro', GUEST: 'Convidado',
}

export default function PlatformClubDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ plan: '', planStatus: '', trialEndsAt: '', planExpiresAt: '' })
  const [dirty, setDirty] = useState(false)
  const [notifMode, setNotifMode] = useState<NotificationMode>('BOTH')
  const [notifDirty, setNotifDirty] = useState(false)

  const { data: club, isLoading } = useQuery({
    queryKey: ['platform-club', id],
    queryFn: () => api.get(`/platform-admin/clubs/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  useEffect(() => {
    if (club) {
      setForm({
        plan: club.plan,
        planStatus: club.planStatus,
        trialEndsAt: club.trialEndsAt ? club.trialEndsAt.slice(0, 10) : '',
        planExpiresAt: club.planExpiresAt ? club.planExpiresAt.slice(0, 10) : '',
      })
      setDirty(false)
      const settings = club.defaultSettings ?? {}
      setNotifMode((settings.notificationMode as NotificationMode) ?? 'BOTH')
      setNotifDirty(false)
    }
  }, [club])

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.patch(`/platform-admin/clubs/${id}/subscription`, {
        plan: data.plan,
        planStatus: data.planStatus,
        trialEndsAt: data.trialEndsAt || null,
        planExpiresAt: data.planExpiresAt || null,
      }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Subscrição actualizada!')
      queryClient.invalidateQueries({ queryKey: ['platform-club', id] })
      queryClient.invalidateQueries({ queryKey: ['platform-admin-clubs'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] })
      setDirty(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao actualizar'),
  })

  function handleFormChange(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  const notifMutation = useMutation({
    mutationFn: (mode: NotificationMode) =>
      api.patch(`/platform-admin/clubs/${id}/notifications`, { notificationMode: mode }).then(r => r.data),
    onSuccess: () => {
      toast.success('Notificações actualizadas!')
      queryClient.invalidateQueries({ queryKey: ['platform-club', id] })
      setNotifDirty(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao guardar'),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full border-t-red-600" />
      </div>
    )
  }

  if (!club) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Clube não encontrado.</p>
        <Link to="/platform-admin/clubs" className="text-red-600 hover:underline">← Voltar aos clubes</Link>
      </div>
    )
  }

  const statusInfo = STATUS_LABELS[club.planStatus] ?? STATUS_LABELS.ACTIVE
  const activeMembers = (club.members ?? []).filter((m: any) => m.status === 'ACTIVE').length

  return (
    <div className="space-y-6 fade-in">
      {/* Back + title */}
      <div>
        <Link
          to="/platform-admin/clubs"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors w-fit"
        >
          <ChevronLeft size={15} /> Todos os clubes
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{club.acronym}</span>
              <span className="text-gray-300">·</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[club.plan]}`}>
                {PLAN_LABELS[club.plan] ?? club.plan}
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
              {club.planStatus === 'TRIAL' && club.trialDaysLeft !== null && (
                <span className="text-xs text-gray-400">{club.trialDaysLeft} dias restantes</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — info + subscription */}
        <div className="lg:col-span-1 space-y-5">
          {/* Club info */}
          <Card>
            <CardHeader><h3 className="font-semibold text-gray-900 text-sm">Informação do Clube</h3></CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700">{club.location}, {club.country}</span>
              </div>
              {club.website && (
                <div className="flex items-start gap-2 text-sm">
                  <Globe size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{club.website}</a>
                </div>
              )}
              {club.motto && (
                <p className="text-xs text-gray-500 italic">"{club.motto}"</p>
              )}
              <div className="pt-2 border-t border-gray-50 grid grid-cols-3 gap-2">
                {[
                  { label: 'Membros', value: activeMembers, icon: <Users size={13} /> },
                  { label: 'Raids', value: club.raidsCount, icon: <Map size={13} /> },
                  { label: 'Registado', value: formatShortDate(club.createdAt), icon: <Calendar size={13} /> },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="flex justify-center text-gray-400 mb-1">{s.icon}</div>
                    <p className="text-sm font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Subscription management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard size={15} className="text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Subscrição</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Plano</label>
                <select
                  value={form.plan}
                  onChange={(e) => handleFormChange('plan', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Estado</label>
                <select
                  value={form.planStatus}
                  onChange={(e) => handleFormChange('planStatus', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Trial termina em"
                type="date"
                value={form.trialEndsAt}
                onChange={(e) => handleFormChange('trialEndsAt', e.target.value)}
              />
              <Input
                label="Plano expira em"
                type="date"
                value={form.planExpiresAt}
                onChange={(e) => handleFormChange('planExpiresAt', e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => updateMutation.mutate(form)}
                loading={updateMutation.isPending}
                disabled={!dirty}
              >
                Guardar alterações
              </Button>
            </CardContent>
          </Card>
          {/* Notification mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Notificações automáticas</h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {NOTIFICATION_OPTIONS.map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    notifMode === opt.value
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="notifMode"
                    value={opt.value}
                    checked={notifMode === opt.value}
                    onChange={() => { setNotifMode(opt.value); setNotifDirty(true) }}
                    className="mt-0.5 accent-red-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
              <Button
                className="w-full mt-2"
                onClick={() => notifMutation.mutate(notifMode)}
                loading={notifMutation.isPending}
                disabled={!notifDirty}
              >
                Guardar configuração
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right column — members */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Membros <span className="text-gray-400 font-normal">({club.members?.length ?? 0})</span>
                </h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-2.5 text-left font-semibold">Nome</th>
                      <th className="pb-2.5 text-left font-semibold">Email / Role</th>
                      <th className="pb-2.5 text-center font-semibold">Estado</th>
                      <th className="pb-2.5 text-left font-semibold">Membro desde</th>
                      <th className="pb-2.5 text-center font-semibold">Email verif.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(club.members ?? []).map((m: any) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="py-3">
                          <p className="font-medium text-gray-900">{m.nickname ? `${m.nickname}` : m.fullName}</p>
                          {m.nickname && <p className="text-xs text-gray-400">{m.fullName}</p>}
                          {m.memberNumber && <p className="text-xs text-gray-400">#{m.memberNumber}</p>}
                        </td>
                        <td className="py-3">
                          {m.user ? (
                            <>
                              <p className="text-gray-700 text-xs truncate max-w-[160px]">{m.user.email}</p>
                              <p className="text-xs text-gray-400">{ROLE_LABELS[m.user.role] ?? m.user.role}</p>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Sem conta</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                            m.status === 'INACTIVE' ? 'bg-gray-100 text-gray-600' :
                            m.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {MEMBER_STATUS_LABELS[m.status] ?? m.status}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-gray-500">
                          {m.joinedAt ? formatShortDate(m.joinedAt) : '—'}
                        </td>
                        <td className="py-3 text-center">
                          {m.user ? (
                            m.user.emailVerified
                              ? <CheckCircle size={15} className="text-green-500 mx-auto" />
                              : <XCircle size={15} className="text-gray-300 mx-auto" />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(club.members ?? []).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                          Nenhum membro neste clube.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
