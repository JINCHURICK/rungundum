import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import {
  Check, Bell, Wallet, Users, AlertCircle,
  Plus, ChevronDown, ChevronUp, Trash2, Search,
  BarChart2, List, Calendar, Settings2, Play, Info,
} from 'lucide-react'

interface AlertConfig {
  enabled: boolean
  firstAlertMonths: number
  secondAlertMonths: number
  disciplinaryMonths: number
  suspensionRiskMonths: number
}

const CURRENT_YEAR  = new Date().getFullYear()
const YEARS         = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)
const PAYMENT_METHODS = ['Numerário', 'Transferência Bancária', 'MB Way', 'TPA', 'Cheque', 'Outro']

// ── types ────────────────────────────────────────────────────────────────────

interface Payment {
  id:            string
  quotaId:       string
  amount:        number
  monthsCount:   number
  paymentMethod: string | null
  reference:     string | null
  notes:         string | null
  paidAt:        string
  confirmedById: string
}

interface MemberQuota {
  memberId:     string
  fullName:     string
  nickname:     string | null
  email:        string | null
  phone:        string | null
  photoUrl:     string | null
  memberNumber: string | null
  quota: {
    id:         string
    dueAmount:  number
    monthsPaid: number
    paidAmount: number
    paidAt:     string | null
    notes:      string | null
    payments:   Payment[]
  } | null
}

interface Summary {
  total:               number
  withQuota:           number
  paidAtLeastOnce:     number
  completePaid:        number
  totalMonthlyDue:     number
  totalAnnualExpected: number
  totalCollected:      number
}

interface HistoryPayment {
  id:            string
  amount:        number
  monthsCount:   number
  paymentMethod: string | null
  reference:     string | null
  notes:         string | null
  paidAt:        string
  quota: {
    member: {
      id:           string
      fullName:     string
      nickname:     string | null
      memberNumber: string | null
      photoUrl:     string | null
    }
  }
}

type TabKey      = 'overview' | 'members' | 'history'
type StatusFilter = 'all' | 'none' | 'pending' | 'partial' | 'complete'

// ── helpers ──────────────────────────────────────────────────────────────────

function getMemberStatus(m: MemberQuota): StatusFilter {
  if (!m.quota) return 'none'
  if (m.quota.monthsPaid === 0) return 'pending'
  if (m.quota.monthsPaid >= 12) return 'complete'
  return 'partial'
}

function Avatar({ name, url, size = 9 }: { name: string; url: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full bg-gray-100 flex-shrink-0 overflow-hidden`
  return (
    <div className={cls}>
      {url
        ? <img src={url} alt={name} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">{name.charAt(0)}</span>
      }
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    none:     { label: 'Sem quota',  cls: 'bg-gray-100 text-gray-500' },
    pending:  { label: 'Pendente',   cls: 'bg-amber-100 text-amber-700' },
    partial:  { label: 'Parcial',    cls: 'bg-blue-100 text-blue-700' },
    complete: { label: '✓ Completo', cls: 'bg-green-100 text-green-700' },
  }
  const { label, cls } = map[status] ?? map.none
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cls}`}>{label}</span>
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Quotas() {
  const { user } = useAuthStore()
  const isAdmin  = user?.role === 'ADMIN' || user?.role === 'CAPTAIN'
  const qc       = useQueryClient()

  // ── global state ──────────────────────────────────────────────────────────
  const [year, setYear] = useState(CURRENT_YEAR)
  const [tab,  setTab]  = useState<TabKey>('overview')

  // ── overview state ────────────────────────────────────────────────────────
  const [showSetDefault,   setShowSetDefault]   = useState(false)
  const [defaultAmountInput, setDefaultAmountInput] = useState('5000')

  // ── members tab state ─────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)

  // ── set-quota modal state ─────────────────────────────────────────────────
  const [settingUp,       setSettingUp]       = useState<MemberQuota | null>(null)
  const [dueAmountInput,  setDueAmountInput]  = useState('5000')
  const [quotaNotesInput, setQuotaNotesInput] = useState('')

  // ── payment modal state ───────────────────────────────────────────────────
  const [registering, setRegistering] = useState<MemberQuota | null>(null)
  const [payMonths,   setPayMonths]   = useState(1)
  const [payAmount,   setPayAmount]   = useState('')
  const [payMethod,   setPayMethod]   = useState('Numerário')
  const [payRef,      setPayRef]      = useState('')
  const [payNotes,    setPayNotes]    = useState('')
  const [payDate,     setPayDate]     = useState(new Date().toISOString().split('T')[0])

  // ── history tab state ─────────────────────────────────────────────────────
  const [histSearch, setHistSearch] = useState('')

  // ── alerts config state ───────────────────────────────────────────────────
  const [showAlerts,  setShowAlerts]  = useState(false)
  const [alertCfg,    setAlertCfg]    = useState<AlertConfig | null>(null)

  // ── queries ───────────────────────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ['quotas', year],
    queryFn:  () => api.get(`/quotas?year=${year}`).then(r => r.data),
  })

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['quotas-history', year],
    queryFn:  () => api.get(`/quotas/history?year=${year}`).then(r => r.data),
    enabled:  tab === 'history',
  })

  useQuery({
    queryKey: ['quotas-alert-config'],
    queryFn:  () => api.get('/quotas/alerts/config').then(r => r.data),
    enabled:  isAdmin,
    onSuccess: (d: AlertConfig) => { if (!alertCfg) setAlertCfg(d) },
  } as any)

  // ── mutations ─────────────────────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: (p: { memberId: string; year: number; dueAmount: number; notes?: string }) =>
      api.post('/quotas', p).then(r => r.data),
    onSuccess: () => {
      toast.success('Quota guardada!')
      qc.invalidateQueries({ queryKey: ['quotas', year] })
      setSettingUp(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao guardar quota'),
  })

  const paymentMutation = useMutation({
    mutationFn: ({ quotaId, ...body }: {
      quotaId:       string
      amount:        number
      monthsCount:   number
      paymentMethod: string
      reference?:    string
      notes?:        string
      paidAt:        string
    }) => api.post(`/quotas/${quotaId}/payments`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('Pagamento registado!')
      qc.invalidateQueries({ queryKey: ['quotas', year] })
      qc.invalidateQueries({ queryKey: ['quotas-history', year] })
      setRegistering(null)
      resetPayForm()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao registar pagamento'),
  })

  const remindMutation = useMutation({
    mutationFn: (quotaId: string) => api.post(`/quotas/${quotaId}/remind`).then(r => r.data),
    onSuccess:  (d) => toast.success(d.message ?? 'Lembrete enviado!'),
    onError:    (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao enviar lembrete'),
  })

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => api.delete(`/quotas/payments/${paymentId}`),
    onSuccess: () => {
      toast.success('Pagamento eliminado!')
      qc.invalidateQueries({ queryKey: ['quotas', year] })
      qc.invalidateQueries({ queryKey: ['quotas-history', year] })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  const saveAlertCfgMutation = useMutation({
    mutationFn: (cfg: AlertConfig) => api.patch('/quotas/alerts/config', cfg).then(r => r.data),
    onSuccess: (d) => { toast.success('Configuração guardada'); setAlertCfg(d) },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  const runAlertsMutation = useMutation({
    mutationFn: () => api.post('/quotas/alerts/run').then(r => r.data),
    onSuccess: (d) => toast.success(`Alertas enviados: ${d.alertsSent} SMS/email · ${d.disciplinaryCreated} processos criados`),
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  // ── derived ───────────────────────────────────────────────────────────────

  const members: MemberQuota[] = data?.members ?? []
  const summary: Summary = data?.summary ?? {
    total: 0, withQuota: 0, paidAtLeastOnce: 0, completePaid: 0,
    totalMonthlyDue: 0, totalAnnualExpected: 0, totalCollected: 0,
  }
  const history: HistoryPayment[] = histData ?? []

  const collectionRate = summary.totalAnnualExpected > 0
    ? Math.min(Math.round((summary.totalCollected / summary.totalAnnualExpected) * 100), 100)
    : 0

  const searchLower = search.toLowerCase()
  const filteredMembers = members.filter(m => {
    if (search && !m.fullName.toLowerCase().includes(searchLower) && !(m.nickname?.toLowerCase().includes(searchLower))) return false
    const s = getMemberStatus(m)
    if (statusFilter === 'none')     return s === 'none'
    if (statusFilter === 'pending')  return s === 'pending'
    if (statusFilter === 'partial')  return s === 'partial'
    if (statusFilter === 'complete') return s === 'complete'
    return true
  })

  const histSearchLower = histSearch.toLowerCase()
  const filteredHistory = history.filter(p => {
    if (!histSearch) return true
    const name = (p.quota.member.nickname ?? p.quota.member.fullName).toLowerCase()
    return name.includes(histSearchLower)
  })

  // ── helpers ───────────────────────────────────────────────────────────────

  function resetPayForm() {
    setPayMonths(1)
    setPayAmount('')
    setPayMethod('Numerário')
    setPayRef('')
    setPayNotes('')
    setPayDate(new Date().toISOString().split('T')[0])
  }

  function openPayModal(m: MemberQuota) {
    setRegistering(m)
    setPayMonths(1)
    setPayAmount(m.quota ? String(m.quota.dueAmount) : '')
    setPayMethod('Numerário')
    setPayRef('')
    setPayNotes('')
    setPayDate(new Date().toISOString().split('T')[0])
  }

  function applyDefault() {
    const amount = parseFloat(defaultAmountInput)
    if (!amount || isNaN(amount)) { toast.error('Valor inválido'); return }
    const noQuota = members.filter(m => !m.quota)
    if (noQuota.length === 0) { toast.error('Todos os membros já têm quota definida'); return }
    Promise.all(noQuota.map(m => api.post('/quotas', { memberId: m.memberId, year, dueAmount: amount })))
      .then(() => {
        toast.success(`${noQuota.length} quotas criadas!`)
        qc.invalidateQueries({ queryKey: ['quotas', year] })
        setShowSetDefault(false)
      })
      .catch(() => toast.error('Erro ao criar quotas'))
  }

  function sendAllReminders() {
    const targets = members.filter(m => m.quota && m.quota.monthsPaid < 12 && (m.email || m.phone))
    if (targets.length === 0) { toast.error('Nenhum membro com contacto por notificar'); return }
    Promise.all(targets.map(m => api.post(`/quotas/${m.quota!.id}/remind`).catch(() => {})))
      .then(() => toast.success(`${targets.length} lembretes enviados!`))
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Quotas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestão de quotas e pagamentos dos membros</p>
        </div>
        <select
          value={year}
          onChange={e => setYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([
          { key: 'overview', label: 'Visão Geral', icon: BarChart2 },
          { key: 'members',  label: 'Por Membro',  icon: Users     },
          { key: 'history',  label: 'Histórico',   icon: List      },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Visão Geral ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1 text-gray-500"><Users size={13} /> Total membros</div>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              <p className="text-xs text-gray-400">{summary.withQuota} com quota definida</p>
            </CardContent></Card>

            <Card><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1 text-amber-600"><AlertCircle size={13} /> Pendentes</div>
              <p className="text-2xl font-bold text-gray-900">{summary.withQuota - summary.paidAtLeastOnce}</p>
              <p className="text-xs text-gray-400">sem pagamentos</p>
            </CardContent></Card>

            <Card><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1 text-green-600"><Check size={13} /> Completo</div>
              <p className="text-2xl font-bold text-gray-900">{summary.completePaid}</p>
              <p className="text-xs text-gray-400">12 meses pagos</p>
            </CardContent></Card>

            <Card><CardContent className="pt-3 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1 text-green-600"><Wallet size={13} /> Cobrado</div>
              <p className="text-lg font-bold text-gray-900">{summary.totalCollected.toLocaleString('pt-AO')} Kz</p>
              <p className="text-xs text-gray-400">de {summary.totalAnnualExpected.toLocaleString('pt-AO')} Kz esperados</p>
            </CardContent></Card>
          </div>

          {/* Barra de progresso */}
          {summary.totalAnnualExpected > 0 && (
            <Card><CardContent className="pt-4 pb-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-gray-700">Taxa de cobrança {year}</p>
                <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{collectionRate}%</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${collectionRate}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <p className="text-xs text-gray-400">{summary.paidAtLeastOnce} membros pagaram pelo menos 1 mês</p>
                <p className="text-xs text-gray-400">
                  Quota média: {summary.withQuota > 0 ? Math.round(summary.totalMonthlyDue / summary.withQuota).toLocaleString('pt-AO') : 0} Kz/mês
                </p>
              </div>
            </CardContent></Card>
          )}

          {/* Acções rápidas */}
          {isAdmin && (
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Acções rápidas</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => setShowSetDefault(v => !v)}>
                  {showSetDefault ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Definir quota padrão
                </Button>
                <Button size="sm" variant="secondary" onClick={sendAllReminders}>
                  <Bell size={14} /> Enviar lembretes
                </Button>
              </div>

              {showSetDefault && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-3">
                    Aplica a membros sem quota definida em {year} ({members.filter(m => !m.quota).length} membros)
                  </p>
                  <div className="flex gap-3 items-end">
                    <div className="w-48">
                      <Input
                        label="Quota mensal (Kz)"
                        type="number"
                        value={defaultAmountInput}
                        onChange={e => setDefaultAmountInput(e.target.value)}
                      />
                    </div>
                    <Button onClick={applyDefault}>Aplicar</Button>
                  </div>
                </div>
              )}
            </CardContent></Card>
          )}

          {/* Alertas automáticos */}
          {isAdmin && alertCfg && (
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={15} className="text-amber-500" />
                    <p className="text-sm font-semibold text-gray-700">Alertas automáticos de quotas</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${alertCfg.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {alertCfg.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setShowAlerts(v => !v)}>
                      <Settings2 size={13} /> {showAlerts ? 'Fechar' : 'Configurar'}
                    </Button>
                    <Button size="sm" onClick={() => runAlertsMutation.mutate()} loading={runAlertsMutation.isPending}>
                      <Play size={13} /> Executar agora
                    </Button>
                  </div>
                </div>

                {/* Resumo dos níveis */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
                  {[
                    { level: 1, label: 'Lembrete',    months: alertCfg.firstAlertMonths,     color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                    { level: 2, label: 'Urgente',     months: alertCfg.secondAlertMonths,    color: 'bg-orange-50 border-orange-200 text-orange-700' },
                    { level: 3, label: 'Disciplinar', months: alertCfg.disciplinaryMonths,   color: 'bg-red-50 border-red-200 text-red-700' },
                    { level: 4, label: 'Suspensão',   months: alertCfg.suspensionRiskMonths, color: 'bg-rose-50 border-rose-300 text-rose-800' },
                  ].map(({ level, label, months, color }) => (
                    <div key={level} className={`border rounded-xl px-3 py-2 ${color}`}>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-lg font-bold">{months}</p>
                      <p className="text-xs opacity-75">mês{months !== 1 ? 'es' : ''} em atraso</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                  <Info size={11} /> O sistema verifica diariamente às 09:00 e envia SMS + email automáticos. Ao nível disciplinar, cria processo automático na ficha do membro.
                </p>

                {/* Painel de configuração */}
                {showAlerts && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* Toggle enabled */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Alertas automáticos activos</p>
                        <p className="text-xs text-gray-400">O cron verifica diariamente e envia SMS + email</p>
                      </div>
                      <button
                        onClick={() => setAlertCfg(c => c ? { ...c, enabled: !c.enabled } : c)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${alertCfg.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${alertCfg.enabled ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>

                    {/* Thresholds */}
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: 'firstAlertMonths',     label: '1º lembrete',           desc: 'SMS + email amigável',          color: 'text-yellow-600' },
                        { key: 'secondAlertMonths',    label: '2º alerta',             desc: 'SMS + email urgente',           color: 'text-orange-600' },
                        { key: 'disciplinaryMonths',   label: 'Alerta disciplinar',    desc: 'Cria processo disciplinar',     color: 'text-red-600'    },
                        { key: 'suspensionRiskMonths', label: 'Risco de suspensão',    desc: 'Aviso de remoção iminente',     color: 'text-rose-700'   },
                      ] as const).map(({ key, label, desc, color }) => (
                        <div key={key} className="border border-gray-100 rounded-xl p-3">
                          <p className={`text-xs font-semibold ${color} mb-1`}>{label}</p>
                          <p className="text-xs text-gray-400 mb-2">{desc}</p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={24}
                              value={alertCfg[key]}
                              onChange={e => setAlertCfg(c => c ? { ...c, [key]: parseInt(e.target.value) || 1 } : c)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                            />
                            <span className="text-xs text-gray-500">meses em atraso</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => saveAlertCfgMutation.mutate(alertCfg)} loading={saveAlertCfgMutation.isPending}>
                        Guardar configuração
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── TAB: Por Membro ───────────────────────────────────────────────────── */}
      {tab === 'members' && (
        <>
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                placeholder="Pesquisar membro..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5 flex-shrink-0 flex-wrap">
              {([
                { key: 'all',      label: 'Todos'     },
                { key: 'pending',  label: 'Pendentes' },
                { key: 'partial',  label: 'Parcial'   },
                { key: 'complete', label: 'Completo'  },
                { key: 'none',     label: 'Sem quota' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === f.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-2 pb-0">
                <div className="divide-y divide-gray-50">
                  {filteredMembers.map(m => {
                    const status     = getMemberStatus(m)
                    const isExpanded = expandedId === m.memberId
                    const payments   = m.quota?.payments ?? []

                    return (
                      <div key={m.memberId}>
                        <div className="py-3 flex items-center gap-3">
                          <Avatar name={m.fullName} url={m.photoUrl} />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {m.nickname ?? m.fullName}
                              {m.memberNumber && <span className="text-gray-400 text-xs ml-1">#{m.memberNumber}</span>}
                            </p>
                            {m.quota ? (
                              <p className="text-xs text-gray-500">
                                {m.quota.dueAmount.toLocaleString('pt-AO')} Kz/mês
                                {m.quota.monthsPaid > 0 && (
                                  <span className="ml-1">
                                    · <strong className="text-gray-700">{m.quota.monthsPaid}</strong> meses pagos
                                    {' '}({m.quota.paidAmount.toLocaleString('pt-AO')} Kz)
                                  </span>
                                )}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 italic">Sem quota definida para {year}</p>
                            )}
                          </div>

                          <StatusBadge status={status} />

                          <div className="flex gap-1 flex-shrink-0">
                            {!m.quota ? (
                              isAdmin && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => { setSettingUp(m); setDueAmountInput('5000'); setQuotaNotesInput('') }}
                                >
                                  Definir
                                </Button>
                              )
                            ) : (
                              <>
                                {isAdmin && (
                                  <Button size="sm" onClick={() => openPayModal(m)}>
                                    <Plus size={13} /> Pagamento
                                  </Button>
                                )}
                                {(m.email || m.phone) && isAdmin && (
                                  <button
                                    onClick={() => remindMutation.mutate(m.quota!.id)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Enviar lembrete"
                                  >
                                    <Bell size={14} />
                                  </button>
                                )}
                                {payments.length > 0 && (
                                  <button
                                    onClick={() => setExpandedId(isExpanded ? null : m.memberId)}
                                    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Ver pagamentos"
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Histórico do membro expandido */}
                        {isExpanded && payments.length > 0 && (
                          <div className="pb-3 pl-12">
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pagamentos</p>
                              <div className="space-y-2">
                                {payments.map(p => (
                                  <div key={p.id} className="flex items-center gap-3 text-xs">
                                    <Calendar size={11} className="text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-500 w-24 flex-shrink-0">
                                      {new Date(p.paidAt).toLocaleDateString('pt-AO')}
                                    </span>
                                    <span className="text-gray-600 w-16 flex-shrink-0">
                                      {p.monthsCount} mês{p.monthsCount !== 1 ? 'es' : ''}
                                    </span>
                                    <span className="font-semibold text-gray-800 flex-1">
                                      {p.amount.toLocaleString('pt-AO')} Kz
                                    </span>
                                    {p.paymentMethod && (
                                      <span className="text-gray-400 hidden sm:block">{p.paymentMethod}</span>
                                    )}
                                    {p.reference && (
                                      <span className="text-gray-400 hidden sm:block">Ref: {p.reference}</span>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          if (window.confirm('Eliminar este pagamento?')) {
                                            deletePaymentMutation.mutate(p.id)
                                          }
                                        }}
                                        className="text-red-300 hover:text-red-500 p-0.5 flex-shrink-0 transition-colors"
                                        title="Eliminar pagamento"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {filteredMembers.length === 0 && (
                    <p className="text-center text-gray-400 text-sm py-10">Nenhum membro encontrado.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── TAB: Histórico ────────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              placeholder="Pesquisar por membro..."
              value={histSearch}
              onChange={e => setHistSearch(e.target.value)}
            />
          </div>

          {histLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
            </div>
          ) : (
            <Card>
              <CardContent className="pt-2 pb-0">
                {filteredHistory.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-10">
                    {history.length === 0
                      ? `Nenhum pagamento registado em ${year}.`
                      : 'Nenhum resultado para a pesquisa.'}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filteredHistory.map(p => (
                      <div key={p.id} className="py-3 flex items-center gap-3">
                        <Avatar name={p.quota.member.fullName} url={p.quota.member.photoUrl} />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {p.quota.member.nickname ?? p.quota.member.fullName}
                            {p.quota.member.memberNumber && (
                              <span className="text-gray-400 text-xs ml-1">#{p.quota.member.memberNumber}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(p.paidAt).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {p.paymentMethod && <span className="ml-1 text-gray-400">· {p.paymentMethod}</span>}
                            {p.reference    && <span className="ml-1 text-gray-400">· Ref: {p.reference}</span>}
                            {p.notes        && <span className="ml-1 text-gray-400">· {p.notes}</span>}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {p.amount.toLocaleString('pt-AO')} Kz
                          </p>
                          <p className="text-xs text-gray-400">
                            {p.monthsCount} mês{p.monthsCount !== 1 ? 'es' : ''}
                          </p>
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm('Eliminar este pagamento? Esta acção é irreversível.')) {
                                deletePaymentMutation.mutate(p.id)
                              }
                            }}
                            className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                            title="Eliminar pagamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {filteredHistory.length > 0 && (
                  <div className="border-t border-gray-50 py-3 flex justify-between">
                    <p className="text-xs text-gray-500">
                      {filteredHistory.length} registo{filteredHistory.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs font-semibold text-gray-700">
                      Total: {filteredHistory.reduce((s, p) => s + p.amount, 0).toLocaleString('pt-AO')} Kz
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Modal: Definir quota ──────────────────────────────────────────────── */}
      <Modal open={!!settingUp} onClose={() => setSettingUp(null)} title="Definir quota">
        {settingUp && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <Avatar name={settingUp.fullName} url={settingUp.photoUrl} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{settingUp.nickname ?? settingUp.fullName}</p>
                <p className="text-xs text-gray-500">Quota anual {year}</p>
              </div>
            </div>
            <Input
              label="Quota mensal (Kz)"
              type="number"
              value={dueAmountInput}
              onChange={e => setDueAmountInput(e.target.value)}
              placeholder="5000"
            />
            <Input
              label="Notas (opcional)"
              value={quotaNotesInput}
              onChange={e => setQuotaNotesInput(e.target.value)}
              placeholder="Quota reduzida, isenção parcial, etc."
            />
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setSettingUp(null)}>Cancelar</Button>
              <Button
                onClick={() => upsertMutation.mutate({
                  memberId:  settingUp.memberId,
                  year,
                  dueAmount: parseFloat(dueAmountInput),
                  notes:     quotaNotesInput || undefined,
                })}
                loading={upsertMutation.isPending}
                disabled={!dueAmountInput || isNaN(parseFloat(dueAmountInput))}
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal: Registar pagamento ─────────────────────────────────────────── */}
      <Modal open={!!registering} onClose={() => { setRegistering(null); resetPayForm() }} title="Registar pagamento">
        {registering && registering.quota && (
          <div className="space-y-4">
            {/* Cabeçalho membro */}
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <Avatar name={registering.fullName} url={registering.photoUrl} />
              <div>
                <p className="text-sm font-semibold text-gray-900">{registering.nickname ?? registering.fullName}</p>
                <p className="text-xs text-gray-500">
                  {registering.quota.dueAmount.toLocaleString('pt-AO')} Kz/mês
                  {registering.quota.monthsPaid > 0 && (
                    <span className="ml-1 text-blue-600">· {registering.quota.monthsPaid} meses já pagos</span>
                  )}
                </p>
              </div>
            </div>

            {/* Selector de meses */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Quantos meses está a pagar?</label>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setPayMonths(m)
                      if (registering.quota?.dueAmount) setPayAmount(String(registering.quota.dueAmount * m))
                    }}
                    className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                      payMonths === m
                        ? 'border-transparent text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                    }`}
                    style={payMonths === m ? { backgroundColor: 'var(--accent)' } : {}}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                {payMonths} × {registering.quota.dueAmount.toLocaleString('pt-AO')} Kz ={' '}
                <strong className="text-gray-700">{(registering.quota.dueAmount * payMonths).toLocaleString('pt-AO')} Kz</strong>
              </p>
            </div>

            <Input
              label="Valor recebido (Kz)"
              type="number"
              value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
            />

            {/* Método */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Método de pagamento</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPayMethod(method)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-medium border transition-all ${
                      payMethod === method
                        ? 'border-transparent text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
                    }`}
                    style={payMethod === method ? { backgroundColor: 'var(--accent)' } : {}}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Data do pagamento"
              type="date"
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
            />
            <Input
              label="Referência (opcional)"
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
              placeholder="Nº de transferência, recibo, etc."
            />
            <Input
              label="Notas (opcional)"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
            />

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => { setRegistering(null); resetPayForm() }}>Cancelar</Button>
              <Button
                onClick={() => paymentMutation.mutate({
                  quotaId:       registering.quota!.id,
                  amount:        parseFloat(payAmount),
                  monthsCount:   payMonths,
                  paymentMethod: payMethod,
                  reference:     payRef  || undefined,
                  notes:         payNotes || undefined,
                  paidAt:        payDate,
                })}
                loading={paymentMutation.isPending}
                disabled={!payAmount || isNaN(parseFloat(payAmount))}
              >
                <Check size={15} /> Confirmar pagamento
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  )
}
