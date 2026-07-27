import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Gavel, ShieldOff, Banknote, Plus, ChevronDown, Check, X, AlertTriangle, Clock } from 'lucide-react'

// ─── tipos ───────────────────────────────────────────────────────────────────

interface SimpleMember { id: string; fullName: string; nickname: string | null; memberNumber: string | null; photoUrl: string | null }

interface DisciplinaryProcess {
  id: string; clubId: string; memberId: string
  title: string; description: string | null
  severity: 'MINOR' | 'MODERATE' | 'SERIOUS'
  status: 'OPEN' | 'REVIEWING' | 'CLOSED'
  outcome: string | null; createdAt: string; closedAt: string | null
  member: SimpleMember
  fines: { id: string; amount: number; status: string }[]
  suspensions: { id: string; startDate: string; endDate: string; liftedAt: string | null }[]
}

interface Suspension {
  id: string; memberId: string; reason: string
  startDate: string; endDate: string; liftedAt: string | null
  notes: string | null; createdAt: string
  member: SimpleMember
  process: { id: string; title: string } | null
}

interface Fine {
  id: string; memberId: string; reason: string
  amount: number; status: 'PENDING' | 'PAID' | 'CANCELLED'
  paidAt: string | null; notes: string | null; createdAt: string
  member: SimpleMember
  process: { id: string; title: string } | null
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_LABELS = { MINOR: 'Leve', MODERATE: 'Moderado', SERIOUS: 'Grave' }
const SEVERITY_COLORS = {
  MINOR: 'bg-yellow-100 text-yellow-700',
  MODERATE: 'bg-orange-100 text-orange-700',
  SERIOUS: 'bg-red-100 text-red-700',
}
const STATUS_LABELS = { OPEN: 'Aberto', REVIEWING: 'Em análise', CLOSED: 'Encerrado' }
const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  REVIEWING: 'bg-purple-100 text-purple-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}
const FINE_STATUS_LABELS = { PENDING: 'Pendente', PAID: 'Pago', CANCELLED: 'Cancelada' }
const FINE_STATUS_COLORS = {
  PENDING: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function Avatar({ m }: { m: SimpleMember }) {
  return (
    <div className="w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
      {m.photoUrl
        ? <img src={m.photoUrl} alt={m.fullName} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-semibold">{m.fullName[0]}</span>
      }
    </div>
  )
}

function MemberName({ m }: { m: SimpleMember }) {
  return (
    <span className="font-medium text-gray-900 text-sm">
      {m.nickname ? `${m.nickname}` : m.fullName}
      {m.memberNumber && <span className="text-gray-400 text-xs ml-1">#{m.memberNumber}</span>}
    </span>
  )
}

function fmt(d: string) { return new Date(d).toLocaleDateString('pt-AO') }

function suspensionStatus(s: Suspension) {
  if (s.liftedAt) return { label: 'Levantada', color: 'bg-green-100 text-green-700' }
  const now = new Date()
  if (new Date(s.endDate) < now) return { label: 'Expirada', color: 'bg-gray-100 text-gray-500' }
  if (new Date(s.startDate) > now) return { label: 'Agendada', color: 'bg-blue-100 text-blue-700' }
  return { label: 'Activa', color: 'bg-red-100 text-red-700' }
}

// ─── tab: Processos ───────────────────────────────────────────────────────────

function ProcessesTab({ members }: { members: SimpleMember[] }) {
  const qc = useQueryClient()
  const { data: processes = [], isLoading } = useQuery<DisciplinaryProcess[]>({
    queryKey: ['disciplinary-processes'],
    queryFn: () => api.get('/disciplinary/processes').then(r => r.data),
  })

  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'REVIEWING' | 'CLOSED'>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<DisciplinaryProcess | null>(null)

  const [form, setForm] = useState({ memberId: '', title: '', description: '', severity: 'MINOR' as const })
  const [outcome, setOutcome] = useState('')

  const createMutation = useMutation({
    mutationFn: () => api.post('/disciplinary/processes', form).then(r => r.data),
    onSuccess: () => {
      toast.success('Processo criado')
      qc.invalidateQueries({ queryKey: ['disciplinary-processes'] })
      setShowCreate(false)
      setForm({ memberId: '', title: '', description: '', severity: 'MINOR' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao criar'),
  })

  function updateStatus(id: string, status: string, out?: string) {
    api.patch(`/disciplinary/processes/${id}`, { status, outcome: out ?? undefined })
      .then(() => { qc.invalidateQueries({ queryKey: ['disciplinary-processes'] }); setDetail(null); toast.success('Processo actualizado') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function deleteProcess(id: string) {
    if (!confirm('Eliminar este processo permanentemente?')) return
    api.delete(`/disciplinary/processes/${id}`)
      .then(() => { qc.invalidateQueries({ queryKey: ['disciplinary-processes'] }); setDetail(null) })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  const filtered = processes.filter(p => filter === 'ALL' || p.status === filter)

  const stats = {
    open: processes.filter(p => p.status === 'OPEN').length,
    reviewing: processes.filter(p => p.status === 'REVIEWING').length,
    closed: processes.filter(p => p.status === 'CLOSED').length,
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Abertos', value: stats.open, color: 'text-blue-600' },
          { label: 'Em análise', value: stats.reviewing, color: 'text-purple-600' },
          { label: 'Encerrados', value: stats.closed, color: 'text-gray-500' },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-3 pb-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['ALL', 'OPEN', 'REVIEWING', 'CLOSED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'ALL' ? 'Todos' : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="ml-auto">
          <Plus size={14} /> Novo processo
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : (
        <Card><CardContent className="pt-0 pb-0">
          <div className="divide-y divide-gray-50">
            {filtered.map(p => (
              <div key={p.id} className="py-3.5 px-1 flex items-start gap-3 cursor-pointer hover:bg-gray-50 rounded-xl -mx-1 px-2 transition-colors" onClick={() => setDetail(p)}>
                <Avatar m={p.member} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MemberName m={p.member} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[p.severity]}`}>{SEVERITY_LABELS[p.severity]}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(p.createdAt)}{p.fines.length > 0 && ` · ${p.fines.length} multa(s)`}{p.suspensions.length > 0 && ` · ${p.suspensions.length} suspensão(ões)`}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Sem processos {filter !== 'ALL' ? STATUS_LABELS[filter as keyof typeof STATUS_LABELS]?.toLowerCase() + 's' : ''}.</p>}
          </div>
        </CardContent></Card>
      )}

      {/* Modal: criar */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo processo disciplinar">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Membro</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
              <option value="">Seleccionar membro...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.nickname ?? m.fullName}{m.memberNumber ? ` #${m.memberNumber}` : ''}</option>)}
            </select>
          </div>
          <Input label="Título / Infracção" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Comportamento inadequado no raid" />
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Descrição (opcional)</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" rows={3}
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes da situação..." />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Gravidade</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as any }))}>
              <option value="MINOR">Leve</option>
              <option value="MODERATE">Moderado</option>
              <option value="SERIOUS">Grave</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!form.memberId || !form.title}>Criar processo</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: detalhe */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Processo disciplinar">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar m={detail.member} />
              <div>
                <MemberName m={detail.member} />
                <div className="flex gap-1.5 mt-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[detail.severity]}`}>{SEVERITY_LABELS[detail.severity]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[detail.status]}`}>{STATUS_LABELS[detail.status]}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="font-semibold text-gray-900 text-sm">{detail.title}</p>
              {detail.description && <p className="text-sm text-gray-600">{detail.description}</p>}
              <p className="text-xs text-gray-400">Aberto em {fmt(detail.createdAt)}{detail.closedAt && ` · Encerrado em ${fmt(detail.closedAt)}`}</p>
            </div>
            {detail.outcome && <div className="bg-blue-50 rounded-xl p-3"><p className="text-sm text-blue-800"><strong>Resultado:</strong> {detail.outcome}</p></div>}

            {detail.status !== 'CLOSED' && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-gray-600">Alterar estado</p>
                <div className="flex gap-2">
                  {detail.status === 'OPEN' && (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(detail.id, 'REVIEWING')}>
                      <Clock size={13} /> Em análise
                    </Button>
                  )}
                  <div className="flex-1">
                    <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none text-xs" rows={2}
                      placeholder="Resultado / decisão final (opcional)..."
                      value={outcome} onChange={e => setOutcome(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={() => updateStatus(detail.id, 'CLOSED', outcome)}>
                    <Check size={13} /> Encerrar
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-gray-100">
              <Button size="sm" variant="secondary" className="text-red-600 hover:bg-red-50" onClick={() => deleteProcess(detail.id)}>
                <X size={13} /> Eliminar
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDetail(null)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── tab: Suspensões ──────────────────────────────────────────────────────────

function SuspensionsTab({ members }: { members: SimpleMember[] }) {
  const qc = useQueryClient()
  const { data: suspensions = [], isLoading } = useQuery<Suspension[]>({
    queryKey: ['disciplinary-suspensions'],
    queryFn: () => api.get('/disciplinary/suspensions').then(r => r.data),
  })

  const [filterActive, setFilterActive] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ memberId: '', reason: '', startDate: '', endDate: '', notes: '' })

  const createMutation = useMutation({
    mutationFn: () => api.post('/disciplinary/suspensions', form).then(r => r.data),
    onSuccess: () => {
      toast.success('Suspensão registada')
      qc.invalidateQueries({ queryKey: ['disciplinary-suspensions'] })
      qc.invalidateQueries({ queryKey: ['members'] })
      setShowCreate(false)
      setForm({ memberId: '', reason: '', startDate: '', endDate: '', notes: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao criar'),
  })

  function lift(id: string) {
    if (!confirm('Levantar esta suspensão? O membro voltará ao estado activo.')) return
    api.patch(`/disciplinary/suspensions/${id}/lift`, {})
      .then(() => { qc.invalidateQueries({ queryKey: ['disciplinary-suspensions'] }); qc.invalidateQueries({ queryKey: ['members'] }); toast.success('Suspensão levantada') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function deleteSuspension(id: string) {
    if (!confirm('Eliminar esta suspensão?')) return
    api.delete(`/disciplinary/suspensions/${id}`)
      .then(() => qc.invalidateQueries({ queryKey: ['disciplinary-suspensions'] }))
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  const now = new Date()
  const isActive = (s: Suspension) => !s.liftedAt && new Date(s.startDate) <= now && new Date(s.endDate) >= now
  const filtered = filterActive ? suspensions.filter(isActive) : suspensions

  const activeCount = suspensions.filter(isActive).length

  return (
    <div className="space-y-4">
      {/* Alert activas */}
      {activeCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
          <span><strong>{activeCount}</strong> suspensão(ões) activa(s) actualmente.</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setFilterActive(false)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!filterActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Todas</button>
          <button onClick={() => setFilterActive(true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterActive ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>Activas</button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="ml-auto">
          <Plus size={14} /> Nova suspensão
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : (
        <Card><CardContent className="pt-0 pb-0">
          <div className="divide-y divide-gray-50">
            {filtered.map(s => {
              const st = suspensionStatus(s)
              const active = !s.liftedAt && new Date(s.startDate) <= now && new Date(s.endDate) >= now
              return (
                <div key={s.id} className="py-3.5 flex items-start gap-3">
                  <Avatar m={s.member} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <MemberName m={s.member} />
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 truncate">{s.reason}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(s.startDate)} → {fmt(s.endDate)}</p>
                    {s.process && <p className="text-xs text-gray-400">Proc.: {s.process.title}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {active && (
                      <Button size="sm" variant="secondary" onClick={() => lift(s.id)}>Levantar</Button>
                    )}
                    <button onClick={() => deleteSuspension(s.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Sem suspensões{filterActive ? ' activas' : ''}.</p>}
          </div>
        </CardContent></Card>
      )}

      {/* Modal: criar */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova suspensão">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Membro</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
              <option value="">Seleccionar membro...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.nickname ?? m.fullName}{m.memberNumber ? ` #${m.memberNumber}` : ''}</option>)}
            </select>
          </div>
          <Input label="Motivo" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Motivo da suspensão" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Data de início</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Data de fim</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <Input label="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações adicionais" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.memberId || !form.reason || !form.startDate || !form.endDate}
            >
              Registar suspensão
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── tab: Multas ──────────────────────────────────────────────────────────────

function FinesTab({ members }: { members: SimpleMember[] }) {
  const qc = useQueryClient()
  const { data: fines = [], isLoading } = useQuery<Fine[]>({
    queryKey: ['disciplinary-fines'],
    queryFn: () => api.get('/disciplinary/fines').then(r => r.data),
  })

  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'CANCELLED'>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ memberId: '', reason: '', amount: '', notes: '' })

  const createMutation = useMutation({
    mutationFn: () => api.post('/disciplinary/fines', { ...form, amount: parseFloat(form.amount) }).then(r => r.data),
    onSuccess: () => {
      toast.success('Multa registada')
      qc.invalidateQueries({ queryKey: ['disciplinary-fines'] })
      setShowCreate(false)
      setForm({ memberId: '', reason: '', amount: '', notes: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao criar'),
  })

  function pay(id: string) {
    if (!confirm('Confirmar pagamento desta multa?')) return
    api.patch(`/disciplinary/fines/${id}/pay`, {})
      .then(() => { qc.invalidateQueries({ queryKey: ['disciplinary-fines'] }); toast.success('Multa marcada como paga') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function cancel(id: string) {
    if (!confirm('Cancelar esta multa?')) return
    api.patch(`/disciplinary/fines/${id}/cancel`, {})
      .then(() => { qc.invalidateQueries({ queryKey: ['disciplinary-fines'] }); toast.success('Multa cancelada') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function deleteFine(id: string) {
    if (!confirm('Eliminar esta multa?')) return
    api.delete(`/disciplinary/fines/${id}`)
      .then(() => qc.invalidateQueries({ queryKey: ['disciplinary-fines'] }))
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  const filtered = fines.filter(f => filter === 'ALL' || f.status === filter)
  const totalPending = fines.filter(f => f.status === 'PENDING').reduce((s, f) => s + f.amount, 0)
  const totalPaid = fines.filter(f => f.status === 'PAID').reduce((s, f) => s + f.amount, 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{fines.filter(f => f.status === 'PENDING').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pendentes</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-lg font-bold text-amber-700">{totalPending.toLocaleString('pt-AO')} Kz</p>
          <p className="text-xs text-gray-500 mt-0.5">Por cobrar</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-lg font-bold text-green-600">{totalPaid.toLocaleString('pt-AO')} Kz</p>
          <p className="text-xs text-gray-500 mt-0.5">Recebido</p>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['ALL', 'PENDING', 'PAID', 'CANCELLED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {f === 'ALL' ? 'Todas' : FINE_STATUS_LABELS[f]}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="ml-auto">
          <Plus size={14} /> Nova multa
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} /></div>
      ) : (
        <Card><CardContent className="pt-0 pb-0">
          <div className="divide-y divide-gray-50">
            {filtered.map(f => (
              <div key={f.id} className="py-3.5 flex items-start gap-3">
                <Avatar m={f.member} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MemberName m={f.member} />
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FINE_STATUS_COLORS[f.status]}`}>{FINE_STATUS_LABELS[f.status]}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 truncate">{f.reason}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{f.amount.toLocaleString('pt-AO')} Kz</p>
                  {f.paidAt && <p className="text-xs text-gray-400">Pago em {fmt(f.paidAt)}</p>}
                  {f.process && <p className="text-xs text-gray-400">Proc.: {f.process.title}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0 items-center">
                  {f.status === 'PENDING' && (
                    <>
                      <Button size="sm" onClick={() => pay(f.id)}>Pago</Button>
                      <Button size="sm" variant="secondary" onClick={() => cancel(f.id)}>Cancelar</Button>
                    </>
                  )}
                  <button onClick={() => deleteFine(f.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Eliminar">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Sem multas.</p>}
          </div>
        </CardContent></Card>
      )}

      {/* Modal: criar */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova multa">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Membro</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
              <option value="">Seleccionar membro...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.nickname ?? m.fullName}{m.memberNumber ? ` #${m.memberNumber}` : ''}</option>)}
            </select>
          </div>
          <Input label="Motivo" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Ex: Ausência injustificada em raid obrigatório" />
          <Input label="Valor (Kz)" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
          <Input label="Notas (opcional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações adicionais" />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.memberId || !form.reason || !form.amount}
            >
              Registar multa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── página principal ─────────────────────────────────────────────────────────

type Tab = 'processes' | 'suspensions' | 'fines'

export default function Disciplinary() {
  const [tab, setTab] = useState<Tab>('processes')

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  })
  const members: SimpleMember[] = (Array.isArray(membersData) ? membersData : []).filter((m: any) => m.status !== 'INACTIVE')

  const tabs = [
    { key: 'processes' as Tab, label: 'Processos', icon: Gavel },
    { key: 'suspensions' as Tab, label: 'Suspensões', icon: ShieldOff },
    { key: 'fines' as Tab, label: 'Multas', icon: Banknote },
  ]

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Disciplinar</h1>
        <p className="text-sm text-gray-500 mt-0.5">Processos disciplinares, suspensões e multas</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'processes' && <ProcessesTab members={members} />}
      {tab === 'suspensions' && <SuspensionsTab members={members} />}
      {tab === 'fines' && <FinesTab members={members} />}
    </div>
  )
}
