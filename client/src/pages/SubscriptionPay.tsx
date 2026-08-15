import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { LogOut, CreditCard, Building2, Copy, CheckCircle2, Upload, ArrowLeft, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'

type PricingTier = { months: number; pricePerMonth: number; totalPrice: number; label: string }
type Plan = { key: string; name: string; pricingTiers: PricingTier[]; maxMembers: number | null; active: boolean }
type PaymentRecord = {
  id: string; invoiceNumber: string; planCode: string; billingCycle: string
  amountKz: number; status: string; planName: string; clubName: string
  bankHolder: string; bankName: string; bankIban: string; bankAccount: string
}

type Step = 'plan' | 'bank' | 'proof' | 'done'

export default function SubscriptionPay() {
  const { club, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('plan')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')
  const [payment, setPayment] = useState<PaymentRecord | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: plans = [], isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ['plans-active'],
    queryFn: async () => (await api.get('/plans/public')).data.filter((p: Plan) => p.active !== false && p.key !== 'FREE'),
  })

  const createPayment = useMutation({
    mutationFn: (body: { planCode: string; billingCycle: string }) => api.post('/subscriptions/payment', body),
    onSuccess: ({ data }: any) => { setPayment(data); setStep('bank') },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao criar pedido'),
  })

  const uploadProof = useMutation({
    mutationFn: async () => {
      if (!payment || !proofFile) throw new Error('Dados em falta')
      const fd = new FormData()
      fd.append('proof', proofFile)
      return api.post(`/subscriptions/payment/${payment.id}/proof`, fd)
    },
    onSuccess: () => setStep('done'),
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao enviar comprovante'),
  })

  async function handleLogout() {
    try { await api.post('/auth/logout', { refreshToken }) } catch {}
    logout()
    navigate('/login')
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function getTier(plan: Plan, cycle: 'MONTHLY' | 'ANNUAL') {
    const months = cycle === 'ANNUAL' ? 12 : 1
    return plan.pricingTiers.find(t => t.months === months) ?? plan.pricingTiers[0] ?? null
  }

  const price = selectedPlan ? (getTier(selectedPlan, billingCycle)?.totalPrice ?? 0) : 0

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header mínimo */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {step !== 'plan' && step !== 'done' && (
            <button onClick={() => setStep(step === 'proof' ? 'bank' : 'plan')} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={18} />
            </button>
          )}
          <span className="font-semibold text-gray-800 text-sm">Rungundum</span>
          {club?.name && <span className="text-gray-400 text-sm">· {club.name}</span>}
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <LogOut size={13} /> Sair
        </button>
      </div>

      {/* Steps indicator */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 text-xs text-gray-400">
        {(['plan', 'bank', 'proof', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-gray-200" />}
            <span className={step === s ? 'text-red-600 font-semibold' : step > s ? 'text-green-600' : ''}>
              {i + 1}. {s === 'plan' ? 'Plano' : s === 'bank' ? 'Pagamento' : s === 'proof' ? 'Comprovante' : 'Concluído'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex-1 flex items-start justify-center p-4 pt-8">
        <div className="w-full max-w-lg">

          {/* ── STEP 1: Escolha de plano ── */}
          {step === 'plan' && (
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Renovar subscrição</h1>
              <p className="text-sm text-gray-500 mb-6">Escolhe o plano e o período de faturação.</p>

              {/* Billing toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-6 bg-white">
                {(['MONTHLY', 'ANNUAL'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setBillingCycle(c)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${billingCycle === c ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {c === 'MONTHLY' ? 'Mensal' : 'Anual'}
                    {c === 'ANNUAL' && <span className="ml-1.5 text-xs opacity-80">· Poupa ~15%</span>}
                  </button>
                ))}
              </div>

              {/* Plan cards */}
              {loadingPlans ? (
                <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : (
                <div className="space-y-3 mb-6">
                  {plans.map(plan => {
                    const tier = getTier(plan, billingCycle)
                    const isSelected = selectedPlan?.key === plan.key
                    return (
                      <button
                        key={plan.key}
                        onClick={() => setSelectedPlan(plan)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-red-600 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900">{plan.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {plan.maxMembers ? `Até ${plan.maxMembers} membros` : 'Membros ilimitados'}
                            </div>
                          </div>
                          <div className="text-right">
                            {tier ? (
                              <>
                                <div className="font-bold text-gray-900">{tier.totalPrice.toLocaleString('pt-AO')} Kz</div>
                                <div className="text-xs text-gray-400">{billingCycle === 'ANNUAL' ? 'por ano' : 'por mês'}</div>
                              </>
                            ) : (
                              <div className="text-xs text-gray-400">Sem preço</div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-700 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} /> Seleccionado
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <button
                disabled={!selectedPlan || createPayment.isPending}
                onClick={() => createPayment.mutate({ planCode: selectedPlan!.key, billingCycle })}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {createPayment.isPending ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Continuar — {selectedPlan ? `${price.toLocaleString('pt-AO')} Kz` : 'Escolhe um plano'}
              </button>
            </div>
          )}

          {/* ── STEP 2: Dados bancários ── */}
          {step === 'bank' && payment && (
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Efectua a transferência</h1>
              <p className="text-sm text-gray-500 mb-4">
                Transfere <strong>{payment.amountKz.toLocaleString('pt-AO')} Kz</strong> para a conta abaixo e depois envia o comprovante.
              </p>

              {/* Invoice badge */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-amber-700 font-medium">Nº Fatura</div>
                  <div className="font-mono font-bold text-amber-900 text-lg">{payment.invoiceNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-amber-700">Plano {payment.planName}</div>
                  <div className="font-bold text-amber-900">{payment.amountKz.toLocaleString('pt-AO')} Kz</div>
                </div>
              </div>

              {/* Bank fields */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <Building2 size={14} className="text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Dados para pagamento</span>
                </div>
                {[
                  { label: 'Titular', value: payment.bankHolder, key: 'holder' },
                  { label: 'Banco', value: payment.bankName, key: 'bank' },
                  { label: 'IBAN', value: payment.bankIban, key: 'iban' },
                  { label: 'Nº Conta', value: payment.bankAccount, key: 'account' },
                  { label: 'Referência', value: payment.invoiceNumber, key: 'ref' },
                  { label: 'Valor', value: `${payment.amountKz.toLocaleString('pt-AO')} Kz`, key: 'amount' },
                ].map(({ label, value, key }) => (
                  <div key={key} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-xs text-gray-400">{label}</div>
                      <div className="font-medium text-gray-900 text-sm">{value}</div>
                    </div>
                    <button
                      onClick={() => copy(value, key)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1.5"
                      title="Copiar"
                    >
                      {copied === key ? <CheckCircle2 size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Usa o número da fatura como referência da transferência para facilitar a identificação.
              </p>

              <button
                onClick={() => setStep('proof')}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
              >
                Já transferi — enviar comprovante
              </button>
            </div>
          )}

          {/* ── STEP 3: Upload comprovante ── */}
          {step === 'proof' && payment && (
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Enviar comprovante</h1>
              <p className="text-sm text-gray-500 mb-6">
                Faz upload do comprovante de transferência. A equipa irá verificar e activar a subscrição.
              </p>

              <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-6 mb-5 text-center">
                {proofFile ? (
                  <div className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-green-600" />
                      <div className="text-left">
                        <div className="text-sm font-medium text-gray-900">{proofFile.name}</div>
                        <div className="text-xs text-gray-500">{(proofFile.size / 1024).toFixed(0)} KB</div>
                      </div>
                    </div>
                    <button onClick={() => setProofFile(null)} className="text-gray-400 hover:text-red-600"><X size={16} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-3 w-full py-4 text-gray-500 hover:text-red-600 transition-colors"
                  >
                    <Upload size={32} className="text-gray-300" />
                    <div>
                      <div className="font-medium text-sm">Clica para seleccionar</div>
                      <div className="text-xs text-gray-400 mt-0.5">JPG, PNG ou PDF — máx. 10 MB</div>
                    </div>
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setProofFile(f) }}
                />
              </div>

              <button
                disabled={!proofFile || uploadProof.isPending}
                onClick={() => uploadProof.mutate()}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {uploadProof.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Enviar comprovante
              </button>
            </div>
          )}

          {/* ── STEP 4: Concluído ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Comprovante enviado!</h1>
              <p className="text-sm text-gray-500 mb-2">
                A nossa equipa irá verificar o pagamento e activar a vossa subscrição em breve.
              </p>
              <p className="text-sm text-gray-500 mb-8">
                Receberás um email de confirmação quando o acesso for reposto.
              </p>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 mx-auto text-sm text-gray-400 hover:text-gray-600"
              >
                <LogOut size={14} /> Terminar sessão
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
