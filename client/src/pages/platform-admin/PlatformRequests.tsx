import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Building2, Filter } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface SubscriptionRequest {
  id: string
  clubId: string
  requestedPlan: string
  requestedPlanLabel: string
  currentPlan: string
  currentPlanLabel: string
  requestedBy: string
  status: RequestStatus
  reviewNotes?: string
  reviewedAt?: string
  createdAt: string
  club: {
    id: string
    name: string
    acronym: string
    location: string
    plan: string
    planStatus: string
    trialEndsAt?: string
    planExpiresAt?: string
  }
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
}

const PLAN_OPTS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']
const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuito', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' }
const STATUS_OPTS = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED']
const STATUS_OPTS_LABELS: Record<string, string> = { TRIAL: 'Trial', ACTIVE: 'Activo', PAST_DUE: 'Em atraso', CANCELLED: 'Cancelado', EXPIRED: 'Expirado' }

function addMonths(months: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export default function PlatformRequests() {
  const [requests, setRequests] = useState<SubscriptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('PENDING')
  const [modal, setModal] = useState<{ request: SubscriptionRequest; action: 'APPROVED' | 'REJECTED' } | null>(null)
  const [form, setForm] = useState({ plan: 'PRO', planStatus: 'ACTIVE', planExpiresAt: addMonths(12), reviewNotes: '' })
  const [saving, setSaving] = useState(false)

  async function load(status = filterStatus) {
    setLoading(true)
    try {
      const { data } = await api.get(`/platform-admin/subscription-requests?status=${status}`)
      setRequests(data)
    } catch {
      toast.error('Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterStatus])

  function openApprove(request: SubscriptionRequest) {
    setForm({ plan: request.requestedPlan, planStatus: 'ACTIVE', planExpiresAt: addMonths(12), reviewNotes: '' })
    setModal({ request, action: 'APPROVED' })
  }

  function openReject(request: SubscriptionRequest) {
    setForm({ plan: request.requestedPlan, planStatus: 'ACTIVE', planExpiresAt: addMonths(12), reviewNotes: '' })
    setModal({ request, action: 'REJECTED' })
  }

  async function handleSubmit() {
    if (!modal) return
    setSaving(true)
    try {
      const body: Record<string, any> = {
        action: modal.action,
        reviewNotes: form.reviewNotes || undefined,
      }
      if (modal.action === 'APPROVED') {
        body.plan = form.plan
        body.planStatus = form.planStatus
        body.planExpiresAt = form.planExpiresAt ? form.planExpiresAt : null
      }
      await api.patch(`/platform-admin/subscription-requests/${modal.request.id}`, body)
      toast.success(modal.action === 'APPROVED' ? 'Pedido aprovado e plano actualizado' : 'Pedido rejeitado')
      setModal(null)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao processar pedido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pedidos de Upgrade</h1>
        <p className="text-sm text-gray-500 mt-1">Gerir pedidos de upgrade enviados pelos clubes.</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={15} className="text-gray-400" />
        {(['PENDING', 'APPROVED', 'REJECTED'] as RequestStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filterStatus === s
                ? s === 'PENDING' ? 'bg-amber-100 text-amber-800'
                  : s === 'APPROVED' ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: '#dc2626' }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Clock size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Sem pedidos {STATUS_LABELS[filterStatus as RequestStatus]?.toLowerCase()}s</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={cn(
              'bg-white rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4',
              r.status === 'PENDING' ? 'border-amber-200' : r.status === 'APPROVED' ? 'border-green-200' : 'border-red-200'
            )}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={15} className="text-gray-400 flex-shrink-0" />
                  <Link to={`/platform-admin/clubs/${r.club.id}`} className="font-semibold text-gray-900 hover:text-red-600 transition-colors truncate text-sm">
                    {r.club.name}
                  </Link>
                  <span className="text-xs text-gray-400">{r.club.location}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                  <span>De: <span className="font-medium text-gray-700">{r.currentPlanLabel}</span></span>
                  <span>→</span>
                  <span>Para: <span className="font-semibold text-red-600">{r.requestedPlanLabel}</span></span>
                  <span>·</span>
                  <span>Por: {r.requestedBy}</span>
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleDateString('pt-AO')}</span>
                </div>
                {r.reviewNotes && (
                  <p className="text-xs text-gray-500 mt-1 italic">Nota: {r.reviewNotes}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {r.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => openApprove(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle2 size={13} />
                      Aprovar
                    </button>
                    <button
                      onClick={() => openReject(r)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <XCircle size={13} />
                      Rejeitar
                    </button>
                  </>
                ) : (
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    r.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  )}>
                    {r.status === 'APPROVED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {STATUS_LABELS[r.status]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {modal.action === 'APPROVED' ? 'Aprovar pedido' : 'Rejeitar pedido'}
            </h2>
            <p className="text-sm text-gray-600">
              Clube: <strong>{modal.request.club.name}</strong><br />
              Pedido: upgrade para <strong className="text-red-600">{modal.request.requestedPlanLabel}</strong>
            </p>

            {modal.action === 'APPROVED' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Plano a activar</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                    {PLAN_OPTS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Estado</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.planStatus} onChange={e => setForm(f => ({ ...f, planStatus: e.target.value }))}>
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{STATUS_OPTS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Validade do plano</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm" value={form.planExpiresAt} onChange={e => setForm(f => ({ ...f, planExpiresAt: e.target.value }))} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '1 mês', months: 1 },
                    { label: '3 meses', months: 3 },
                    { label: '6 meses', months: 6 },
                    { label: '1 ano', months: 12 },
                    { label: '2 anos', months: 24 },
                  ].map(opt => (
                    <button
                      key={opt.months}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, planExpiresAt: addMonths(opt.months) }))}
                      className="px-2.5 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                    >
                      +{opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nota (opcional)</label>
              <textarea rows={2} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" placeholder="Motivo ou observação..." value={form.reviewNotes} onChange={e => setForm(f => ({ ...f, reviewNotes: e.target.value }))} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 text-sm rounded-lg border text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={cn(
                  'flex-1 px-4 py-2 text-sm rounded-lg font-semibold text-white transition-colors disabled:opacity-60',
                  modal.action === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {saving ? 'A guardar...' : modal.action === 'APPROVED' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
