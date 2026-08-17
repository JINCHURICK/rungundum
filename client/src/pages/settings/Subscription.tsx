import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Check, Users, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react'

type PricingTier = { months: number; pricePerMonth: number; totalPrice: number; label: string }
type Plan = { key: string; name: string; pricingTiers: PricingTier[]; maxMembers: number | null; active: boolean }

interface MeData {
  plan: string
  planLabel: string
  planStatus: string
  trialEndsAt: string | null
  planExpiresAt: string | null
  limits: { maxMembers: number | null }
  usage: { membersCount: number }
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  TRIAL:    { label: 'Trial',      cls: 'bg-blue-100 text-blue-700'   },
  ACTIVE:   { label: 'Activo',     cls: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'Em atraso',  cls: 'bg-amber-100 text-amber-700' },
  EXPIRED:  { label: 'Expirado',   cls: 'bg-red-100 text-red-600'     },
  CANCELLED:{ label: 'Cancelado',  cls: 'bg-gray-100 text-gray-500'   },
}

function fmtKz(n: number) { return n.toLocaleString('pt-AO') + ' Kz' }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })
}
function daysLeft(s: string | null) {
  if (!s) return null
  const diff = Math.ceil((new Date(s).getTime() - Date.now()) / 86_400_000)
  return diff
}

export default function Subscription() {
  const navigate = useNavigate()
  const [billing, setBilling] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')

  const { data: me, isLoading: loadingMe } = useQuery<MeData>({
    queryKey: ['subscription-me'],
    queryFn: () => api.get('/subscriptions/me').then(r => r.data),
  })

  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ['plans-active'],
    queryFn: () => api.get('/plans/public').then(r => r.data.filter((p: Plan) => p.active !== false && p.key !== 'FREE')),
  })

  if (loadingMe || loadingPlans) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  const statusMeta = STATUS_LABELS[me?.planStatus ?? ''] ?? STATUS_LABELS.TRIAL
  const activeMembers = me?.usage.membersCount ?? 0
  const memberLimit = me?.limits.maxMembers ?? null
  const usage = memberLimit ? Math.round((activeMembers / memberLimit) * 100) : 0
  const days = daysLeft(me?.planExpiresAt ?? null)
  const isExpired = me?.planStatus === 'EXPIRED' || (days !== null && days <= 0)

  function getTier(plan: Plan) {
    const months = billing === 'ANNUAL' ? 12 : 1
    return plan.pricingTiers.find(t => t.months === months) ?? plan.pricingTiers[0] ?? null
  }

  return (
    <div className="fade-in space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Subscrição</h1>
        <p className="text-sm text-gray-500 mt-0.5">Plano e limites do teu clube</p>
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
              <p className="text-2xl font-bold text-gray-900">{me?.planLabel ?? me?.plan ?? '—'}</p>
              {me?.planExpiresAt && (
                <p className="text-sm text-gray-400 mt-1">
                  {isExpired
                    ? <span className="text-red-600 font-medium">Expirou em {fmtDate(me.planExpiresAt)}</span>
                    : <>Válido até {fmtDate(me.planExpiresAt)} {days !== null && days <= 30 && <span className="text-amber-600 font-medium">· {days} dia{days !== 1 ? 's' : ''}</span>}</>
                  }
                </p>
              )}
              {me?.trialEndsAt && me.planStatus === 'TRIAL' && (
                <p className="text-sm text-amber-600 mt-1">Trial termina em {fmtDate(me.trialEndsAt)}</p>
              )}
            </div>

            {isExpired ? (
              <Button onClick={() => navigate('/subscription/pay')} className="flex items-center gap-2">
                <RefreshCw size={14} /> Renovar subscrição
              </Button>
            ) : (
              days !== null && days <= 30 && (
                <Button variant="secondary" onClick={() => navigate('/subscription/pay')} className="flex items-center gap-2">
                  <RefreshCw size={14} /> Renovar antecipadamente
                </Button>
              )
            )}
          </div>

          {/* Barra de membros */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Users size={14} /> Membros activos
              </div>
              <span className="text-sm font-bold text-gray-900">
                {activeMembers} / {memberLimit !== null ? memberLimit : '∞'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${usage >= 100 ? 'bg-red-500' : usage >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(usage, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {memberLimit !== null
                ? `${Math.max(0, memberLimit - activeMembers)} lugar${memberLimit - activeMembers !== 1 ? 'es' : ''} disponível${memberLimit - activeMembers !== 1 ? 'eis' : ''}`
                : 'Membros ilimitados neste plano'}
            </p>
            {usage >= 80 && memberLimit !== null && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                ⚠️ Estás a {usage}% da capacidade. Considera fazer upgrade.
              </p>
            )}
          </div>

          {isExpired && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                A subscrição expirou. Renova para recuperar o acesso completo ao sistema.
              </p>
            </div>
          )}
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
                <>Anual <span className="text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">~15% poupança</span></>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards dos planos */}
      {plans.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhum plano disponível de momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plans.map(plan => {
            const isCurrent = me?.plan?.toUpperCase() === plan.key?.toUpperCase()
            const tier = getTier(plan)
            const price = tier?.totalPrice ?? 0
            const pricePerMonth = tier?.pricePerMonth ?? 0

            return (
              <div
                key={plan.key}
                className={`rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all ${
                  isCurrent ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {plan.maxMembers !== null ? `Até ${plan.maxMembers} membros` : 'Membros ilimitados'}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Actual</span>
                  )}
                </div>

                <div>
                  {tier ? (
                    <>
                      <p className="text-xl font-bold text-gray-900">{fmtKz(price)}</p>
                      {billing === 'ANNUAL'
                        ? <p className="text-xs text-gray-400">/ano · {fmtKz(pricePerMonth)}/mês</p>
                        : <p className="text-xs text-gray-400">/mês</p>
                      }
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Preço não configurado</p>
                  )}
                </div>

                {isCurrent ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <Check size={13} /> Plano actual
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/subscription/pay')}
                    className="w-full mt-auto"
                  >
                    Solicitar upgrade <ArrowRight size={13} />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        Para renovar ou mudar de plano, efectua uma transferência bancária e envia o comprovante. O acesso é activado após confirmação pela equipa Rungundum.
      </p>
    </div>
  )
}
