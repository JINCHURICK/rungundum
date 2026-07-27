import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Check, Users, ArrowRight, Crown, Zap, Flame, Globe } from 'lucide-react'

interface Plan {
  id: string
  code: string
  name: string
  priceMonthlyKz: number
  priceAnnualKz: number
  memberLimit: number | null
  isActive: boolean
}

interface SubscriptionData {
  subscription: {
    id: string
    status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED'
    billingCycle: 'MONTHLY' | 'ANNUAL'
    currentPeriodStart: string
    currentPeriodEnd: string
    paymentReference: string | null
    plan: Plan
  } | null
  plans: Plan[]
  activeMembers: number
  memberLimit: number | null
  usagePercent: number
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  arranque: Zap,
  comitiva: Flame,
  raid:     Crown,
  nacional: Globe,
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  TRIAL:    { label: 'Trial',     cls: 'bg-blue-100 text-blue-700'   },
  ACTIVE:   { label: 'Activo',    cls: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'Em atraso', cls: 'bg-amber-100 text-amber-700' },
  CANCELLED:{ label: 'Cancelado', cls: 'bg-gray-100 text-gray-500'   },
}

function fmtKz(n: number) { return n.toLocaleString('pt-AO') + ' Kz' }
function fmtDate(s: string) { return new Date(s).toLocaleDateString('pt-AO') }

export default function Subscription() {
  const qc = useQueryClient()
  const [billing, setBilling]               = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [targetPlan, setTargetPlan]         = useState<Plan | null>(null)
  const [payRef, setPayRef]                 = useState('')

  const { data, isLoading } = useQuery<SubscriptionData>({
    queryKey: ['subscription-current'],
    queryFn:  () => api.get('/subscriptions/current').then(r => r.data),
  })

  const switchMutation = useMutation({
    mutationFn: (p: { planCode: string; billingCycle: string; paymentReference?: string }) =>
      api.post('/subscriptions/switch-plan', p).then(r => r.data),
    onSuccess: () => {
      toast.success('Plano actualizado!')
      qc.invalidateQueries({ queryKey: ['subscription-current'] })
      setShowUpgradeModal(false)
      setPayRef('')
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao mudar plano'),
  })

  function openUpgrade(plan: Plan) {
    setTargetPlan(plan)
    setPayRef('')
    setShowUpgradeModal(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  const sub        = data?.subscription
  const plans      = data?.plans ?? []
  const current    = sub?.plan
  const limit      = data?.memberLimit ?? null
  const active     = data?.activeMembers ?? 0
  const usage      = data?.usagePercent ?? 0
  const status     = sub?.status ?? 'TRIAL'
  const statusMeta = STATUS_LABELS[status] ?? STATUS_LABELS.TRIAL

  const annualSavings = targetPlan
    ? Math.round(100 - (targetPlan.priceAnnualKz / (targetPlan.priceMonthlyKz * 12)) * 100)
    : 0

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Subscrição</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gere o plano e limites do teu clube</p>
      </div>

      {/* Estado actual */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Plano actual</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>{statusMeta.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{current?.name ?? '—'}</p>
              {sub && (
                <p className="text-sm text-gray-400 mt-1">
                  {sub.billingCycle === 'MONTHLY' ? 'Facturação mensal' : 'Facturação anual'} ·
                  Válido até {fmtDate(sub.currentPeriodEnd)}
                </p>
              )}
              {sub?.paymentReference && (
                <p className="text-xs text-gray-400 mt-0.5">Ref. pagamento: {sub.paymentReference}</p>
              )}
            </div>
            <div className="text-right">
              {current && (
                <>
                  <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                    {fmtKz(sub?.billingCycle === 'ANNUAL' ? current.priceAnnualKz : current.priceMonthlyKz)}
                  </p>
                  <p className="text-xs text-gray-400">{sub?.billingCycle === 'ANNUAL' ? '/ano' : '/mês'}</p>
                </>
              )}
            </div>
          </div>

          {/* Barra de uso */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Users size={14} /> Membros activos
              </div>
              <span className="text-sm font-bold text-gray-900">
                {active} / {limit !== null ? limit : '∞'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${usage >= 100 ? 'bg-red-500' : usage >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(usage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {limit !== null
                ? `${Math.max(0, limit - active)} lugar${limit - active !== 1 ? 'es' : ''} disponível${limit - active !== 1 ? 'eis' : ''}`
                : 'Membros ilimitados neste plano'
              }
            </p>
            {usage >= 80 && limit !== null && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                ⚠️ Estás a {usage}% da capacidade. Considera fazer upgrade para continuar a crescer.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toggle mensal / anual */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">Planos disponíveis</p>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['MONTHLY', 'ANNUAL'] as const).map(b => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${billing === b ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {b === 'MONTHLY' ? 'Mensal' : (
                <>Anual <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">2 meses grátis</span></>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards dos planos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {plans.map(plan => {
          const isCurrent = current?.code === plan.code
          const isPopular = plan.code === 'comitiva'
          const price     = billing === 'ANNUAL' ? plan.priceAnnualKz : plan.priceMonthlyKz
          const savings   = Math.round(100 - (plan.priceAnnualKz / (plan.priceMonthlyKz * 12)) * 100)
          const Icon      = PLAN_ICONS[plan.code] ?? Zap

          return (
            <div
              key={plan.code}
              className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all ${
                isCurrent
                  ? 'border-red-500 bg-red-50'
                  : isPopular ? 'border-gray-300 bg-white shadow-sm' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isCurrent ? 'bg-red-100' : 'bg-gray-100'}`}>
                    <Icon size={15} className={isCurrent ? 'text-red-600' : 'text-gray-600'} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{plan.name}</p>
                    <p className="text-xs text-gray-400">
                      {plan.memberLimit !== null ? `Até ${plan.memberLimit} membros` : 'Ilimitado'}
                    </p>
                  </div>
                </div>
                {isPopular && !isCurrent && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Popular</span>
                )}
                {isCurrent && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Actual</span>
                )}
              </div>

              <div>
                <p className="text-xl font-bold text-gray-900">{fmtKz(price)}</p>
                {billing === 'ANNUAL'
                  ? <p className="text-xs text-gray-400">/ano · {fmtKz(Math.round(price / 12))}/mês <span className="text-green-600">(-{savings}%)</span></p>
                  : <p className="text-xs text-gray-400">/mês</p>
                }
              </div>

              {isCurrent ? (
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <Check size={13} /> Plano actual
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={isPopular ? 'primary' : 'secondary'}
                  onClick={() => openUpgrade(plan)}
                  className="w-full mt-auto"
                >
                  {plan.priceMonthlyKz > (current?.priceMonthlyKz ?? 0) ? 'Fazer upgrade' : 'Mudar plano'}
                  <ArrowRight size={13} />
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal de confirmação */}
      <Modal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} title={`Mudar para ${targetPlan?.name ?? ''}`}>
        {targetPlan && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-gray-700">{targetPlan.name}</p>
              <p className="text-xs text-gray-500">
                {targetPlan.memberLimit !== null ? `Até ${targetPlan.memberLimit} membros activos` : 'Membros ilimitados'}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {fmtKz(billing === 'ANNUAL' ? targetPlan.priceAnnualKz : targetPlan.priceMonthlyKz)}
                <span className="text-sm font-normal text-gray-400"> {billing === 'ANNUAL' ? '/ano' : '/mês'}</span>
              </p>
              {billing === 'ANNUAL' && (
                <p className="text-xs text-green-600">Poupas {annualSavings}% em relação ao mensal</p>
              )}
            </div>

            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {(['MONTHLY', 'ANNUAL'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${billing === b ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {b === 'MONTHLY' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>

            <Input
              label="Referência de pagamento (opcional)"
              placeholder="Ex: TRF2025-001, Multicaixa #123..."
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
            />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <p className="font-semibold mb-1">Como funciona</p>
              <p>Efectua a transferência bancária ou pagamento Multicaixa e indica a referência. O administrador confirmará o pagamento e activará o plano.</p>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <Button variant="secondary" onClick={() => setShowUpgradeModal(false)}>Cancelar</Button>
              <Button
                onClick={() => switchMutation.mutate({ planCode: targetPlan.code, billingCycle: billing, ...(payRef && { paymentReference: payRef }) })}
                loading={switchMutation.isPending}
              >
                Confirmar mudança
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
