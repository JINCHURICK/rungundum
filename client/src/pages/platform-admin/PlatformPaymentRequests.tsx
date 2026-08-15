import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, XCircle, Eye, Filter, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

type Payment = {
  id: string
  invoiceNumber: string
  planCode: string
  billingCycle: 'MONTHLY' | 'ANNUAL'
  amountKz: number
  status: 'PENDING_PROOF' | 'PROOF_UPLOADED' | 'APPROVED' | 'REJECTED'
  proofUrl: string | null
  reviewNotes: string | null
  renewMonths: number | null
  createdAt: string
  reviewedAt: string | null
  club: { id: string; name: string; acronym: string; location: string; plan: string; planStatus: string }
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING_PROOF:  { label: 'A aguardar comprovante', color: 'text-amber-600 bg-amber-50' },
  PROOF_UPLOADED: { label: 'Comprovante enviado',    color: 'text-blue-600 bg-blue-50'   },
  APPROVED:       { label: 'Aprovado',               color: 'text-green-700 bg-green-50' },
  REJECTED:       { label: 'Rejeitado',              color: 'text-red-600 bg-red-50'     },
}

export default function PlatformPaymentRequests() {
  const qc = useQueryClient()
  const [filterStatus, setFilterStatus] = useState<string>('PROOF_UPLOADED')
  const [selected, setSelected] = useState<Payment | null>(null)
  const [renewMonths, setRenewMonths] = useState(1)
  const [rejectNotes, setRejectNotes] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['platform-payment-requests', filterStatus],
    queryFn: async () => {
      const params = filterStatus !== 'ALL' ? `?status=${filterStatus}` : ''
      return (await api.get(`/platform-admin/payment-requests${params}`)).data
    },
    refetchInterval: 30_000,
  })

  const reviewMutation = useMutation({
    mutationFn: (body: { action: 'APPROVE' | 'REJECT'; renewMonths?: number; reviewNotes?: string }) =>
      api.patch(`/platform-admin/payment-requests/${selected!.id}`, body),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'APPROVE' ? 'Subscrição aprovada!' : 'Pedido rejeitado')
      qc.invalidateQueries({ queryKey: ['platform-payment-requests'] })
      setSelected(null)
      setAction(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  const pending = payments.filter(p => p.status === 'PROOF_UPLOADED').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pedidos de Pagamento</h1>
          <p className="text-sm text-gray-500 mt-0.5">Comprovantes de transferência bancária submetidos pelos clubes</p>
        </div>
        {pending > 0 && (
          <div className="bg-blue-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full">
            {pending} a aguardar revisão
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {[
          { value: 'PROOF_UPLOADED', label: 'Para Rever' },
          { value: 'PENDING_PROOF',  label: 'Aguarda Comprovante' },
          { value: 'APPROVED',       label: 'Aprovados' },
          { value: 'REJECTED',       label: 'Rejeitados' },
          { value: 'ALL',            label: 'Todos' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilterStatus(f.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === f.value ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">A carregar...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Filter size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum pedido para este filtro</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Fatura</th>
                <th className="text-left px-4 py-3">Clube</th>
                <th className="text-left px-4 py-3">Plano</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => {
                const st = STATUS_LABEL[p.status]
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{p.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.club.name}</div>
                      <div className="text-xs text-gray-400">{p.club.location}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{p.planCode}</div>
                      <div className="text-xs text-gray-400">{p.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {p.amountKz.toLocaleString('pt-AO')} Kz
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {format(new Date(p.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(p); setAction(null); setRenewMonths(p.billingCycle === 'ANNUAL' ? 12 : 1); setRejectNotes('') }}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setSelected(null); setAction(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">{selected.invoiceNumber}</div>
                <div className="text-sm text-gray-500">{selected.club.name}</div>
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_LABEL[selected.status].color}`}>
                {STATUS_LABEL[selected.status].label}
              </span>
            </div>

            <div className="p-6 space-y-4">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Clube', selected.club.name],
                  ['Local', selected.club.location],
                  ['Plano', `${selected.planCode} · ${selected.billingCycle === 'ANNUAL' ? 'Anual' : 'Mensal'}`],
                  ['Valor', `${selected.amountKz.toLocaleString('pt-AO')} Kz`],
                  ['Submetido', format(new Date(selected.createdAt), 'dd/MM/yyyy HH:mm')],
                  ...(selected.reviewedAt ? [['Revisto em', format(new Date(selected.reviewedAt), 'dd/MM/yyyy HH:mm')]] : []),
                  ...(selected.renewMonths ? [['Renovação concedida', `${selected.renewMonths} meses`]] : []),
                  ...(selected.reviewNotes ? [['Notas', selected.reviewNotes]] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="font-medium text-gray-900">{value}</div>
                  </div>
                ))}
              </div>

              {/* Proof link */}
              {selected.proofUrl && (
                <a
                  href={selected.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ExternalLink size={14} /> Ver comprovante de pagamento
                </a>
              )}

              {/* Action buttons — only for PROOF_UPLOADED */}
              {selected.status === 'PROOF_UPLOADED' && !action && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setAction('approve')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                  >
                    <CheckCircle2 size={15} /> Aprovar
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    <XCircle size={15} /> Rejeitar
                  </button>
                </div>
              )}

              {/* Approve form */}
              {action === 'approve' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Meses a renovar</label>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 3, 6, 12, 24].map(m => (
                        <button
                          key={m}
                          onClick={() => setRenewMonths(m)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${renewMonths === m ? 'bg-green-600 border-green-600 text-white' : 'border-gray-200 text-gray-600 hover:border-green-400'}`}
                        >
                          {m === 1 ? '1 mês' : m === 12 ? '1 ano' : m === 24 ? '2 anos' : `${m} meses`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="number" min={1} max={36} value={renewMonths}
                    onChange={e => setRenewMonths(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center font-semibold"
                    placeholder="Ou digita o nº de meses"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setAction(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ action: 'APPROVE', renewMonths })}
                      className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? 'A aprovar...' : `Confirmar — ${renewMonths} ${renewMonths === 1 ? 'mês' : 'meses'}`}
                    </button>
                  </div>
                </div>
              )}

              {/* Reject form */}
              {action === 'reject' && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Motivo da rejeição (opcional)</label>
                    <textarea
                      value={rejectNotes}
                      onChange={e => setRejectNotes(e.target.value)}
                      rows={3}
                      placeholder="Ex: Transferência não identificada na conta..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-red-400"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAction(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button
                      disabled={reviewMutation.isPending}
                      onClick={() => reviewMutation.mutate({ action: 'REJECT', reviewNotes: rejectNotes })}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                    >
                      {reviewMutation.isPending ? 'A rejeitar...' : 'Confirmar rejeição'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
