import { useEffect, useState } from 'react'
import { Settings2, Save, RotateCcw, Trash2, Plus, Tag, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// ── types ─────────────────────────────────────────────────────────────────────

interface PricingTier {
  months:        number
  pricePerMonth: number
  totalPrice:    number
  label:         string
}

interface PlanConfig {
  key:                string
  name:               string
  description:        string
  currency:           string
  contactOnly:        boolean
  highlight:          boolean
  maxMembers:         number | null
  maxRaidsPerMonth:   number | null
  emailNotifications: boolean
  leaguesEnabled:     boolean
  active:             boolean
  displayOrder:       number
  features:           string[]
  pricingTiers:       PricingTier[]
}

// ── constants ─────────────────────────────────────────────────────────────────

const ALL_PLAN_KEYS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE']

const KEY_COLORS: Record<string, string> = {
  FREE:       'bg-gray-100 text-gray-700',
  STARTER:    'bg-blue-100 text-blue-700',
  PRO:        'bg-red-100 text-red-700',
  ENTERPRISE: 'bg-purple-100 text-purple-700',
}

const QUICK_PERIODS = [
  { months: 1,  label: 'Mensal'      },
  { months: 3,  label: 'Trimestral'  },
  { months: 6,  label: 'Semestral'   },
  { months: 12, label: 'Anual'       },
]

const DEFAULT_FOR_KEY: Record<string, Partial<PlanConfig>> = {
  FREE:       { name: 'Gratuito',   description: 'Ideal para clubes a começar',                   contactOnly: false, maxMembers: 10,   maxRaidsPerMonth: 3,    emailNotifications: false, pricingTiers: [] },
  STARTER:    { name: 'Starter',    description: 'Para clubes em crescimento',                    contactOnly: false, maxMembers: 30,   maxRaidsPerMonth: 10,   emailNotifications: true,  pricingTiers: [] },
  PRO:        { name: 'Pro',        description: 'Para clubes estabelecidos',                     contactOnly: false, maxMembers: null, maxRaidsPerMonth: null, emailNotifications: true,  pricingTiers: [] },
  ENTERPRISE: { name: 'Enterprise', description: 'Para federações e grandes organizações',        contactOnly: true,  maxMembers: null, maxRaidsPerMonth: null, emailNotifications: true,  pricingTiers: [] },
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string) {
  return `${n.toLocaleString('pt-AO')} ${currency}`
}

function savingsPct(tier: PricingTier, basePricePerMonth: number): number {
  if (!basePricePerMonth || tier.pricePerMonth >= basePricePerMonth) return 0
  return Math.round((1 - tier.pricePerMonth / basePricePerMonth) * 100)
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PlatformPlans() {
  const [configs,  setConfigs]  = useState<PlanConfig[]>([])
  const [original, setOriginal] = useState<PlanConfig[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [editIdx,  setEditIdx]  = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/platform-admin/plan-configs')
      setConfigs(data)
      setOriginal(JSON.parse(JSON.stringify(data)))
    } catch {
      toast.error('Erro ao carregar configurações de planos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── plan-level updates ────────────────────────────────────────────────────

  function updatePlan(idx: number, field: keyof PlanConfig, value: any) {
    setConfigs(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  function deletePlan(idx: number) {
    setEditIdx(null)
    setConfigs(prev => prev.filter((_, i) => i !== idx))
  }

  function addPlan(key: string) {
    const defs = DEFAULT_FOR_KEY[key] ?? {}
    const plan: PlanConfig = {
      key, currency: 'Kz', leaguesEnabled: false, active: true, displayOrder: configs.length,
      name: defs.name ?? key, description: defs.description ?? '',
      contactOnly: defs.contactOnly ?? false, highlight: false,
      maxMembers: defs.maxMembers ?? null, maxRaidsPerMonth: defs.maxRaidsPerMonth ?? null,
      emailNotifications: defs.emailNotifications ?? false,
      features: defs.features ?? [], pricingTiers: defs.pricingTiers ?? [],
    }
    setConfigs(prev => [...prev, plan])
    setEditIdx(configs.length)
  }

  // ── tier-level updates ────────────────────────────────────────────────────

  function addTier(planIdx: number, months: number, label: string) {
    const existing = configs[planIdx].pricingTiers.find(t => t.months === months)
    if (existing) { toast.error(`Já existe um período de ${months} meses`); return }

    // Base monthly price: cheapest existing tier or 0
    const baseTier = [...configs[planIdx].pricingTiers].sort((a, b) => a.months - b.months)[0]
    const basePrice = baseTier?.pricePerMonth ?? 0

    const tier: PricingTier = { months, pricePerMonth: basePrice, totalPrice: basePrice * months, label }
    setConfigs(prev => prev.map((c, i) => i !== planIdx ? c : {
      ...c,
      pricingTiers: [...c.pricingTiers, tier].sort((a, b) => a.months - b.months),
    }))
  }

  function updateTier(planIdx: number, tierIdx: number, field: keyof PricingTier, raw: string) {
    setConfigs(prev => prev.map((c, i) => {
      if (i !== planIdx) return c
      const tiers = c.pricingTiers.map((t, j) => {
        if (j !== tierIdx) return t
        const months = t.months
        if (field === 'months') {
          const val = parseInt(raw) || 1
          return { ...t, months: val, totalPrice: Math.round(t.pricePerMonth * val) }
        }
        if (field === 'pricePerMonth') {
          const val = parseFloat(raw) || 0
          return { ...t, pricePerMonth: val, totalPrice: Math.round(val * months) }
        }
        if (field === 'totalPrice') {
          const val = parseFloat(raw) || 0
          return { ...t, totalPrice: val, pricePerMonth: months > 0 ? Math.round(val / months) : 0 }
        }
        return { ...t, [field]: raw }
      })
      return { ...c, pricingTiers: tiers }
    }))
  }

  function deleteTier(planIdx: number, tierIdx: number) {
    setConfigs(prev => prev.map((c, i) => i !== planIdx ? c : {
      ...c, pricingTiers: c.pricingTiers.filter((_, j) => j !== tierIdx),
    }))
  }

  // ── save / reset ──────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    try {
      const { data } = await api.put('/platform-admin/plan-configs', configs)
      setConfigs(data)
      setOriginal(JSON.parse(JSON.stringify(data)))
      setEditIdx(null)
      toast.success('Configurações de planos guardadas')
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setConfigs(JSON.parse(JSON.stringify(original)))
    setEditIdx(null)
  }

  const isDirty = JSON.stringify(configs) !== JSON.stringify(original)
  const availableToAdd = ALL_PLAN_KEYS.filter(k => !configs.some(c => c.key === k))

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: '#dc2626' }} />
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração de Planos</h1>
          <p className="text-sm text-gray-500 mt-1">Define preços por período, limites e funcionalidades de cada plano.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {availableToAdd.length > 0 && (
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                <Plus size={14} /> Adicionar plano
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 hidden group-hover:block min-w-[140px]">
                {availableToAdd.map(key => (
                  <button key={key} onClick={() => addPlan(key)} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', KEY_COLORS[key] ?? 'bg-gray-100 text-gray-700')}>{key}</span>
                    {DEFAULT_FOR_KEY[key]?.name ?? key}
                  </button>
                ))}
              </div>
            </div>
          )}
          {isDirty && (
            <>
              <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
                <RotateCcw size={14} /> Reverter
              </button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-60">
                <Save size={14} /> {saving ? 'A guardar...' : 'Guardar alterações'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid sm:grid-cols-2 gap-5">
        {configs.map((config, idx) => {
          const isEdit       = editIdx === idx
          const sortedTiers  = [...config.pricingTiers].sort((a, b) => a.months - b.months)
          const basePPM      = sortedTiers[0]?.pricePerMonth ?? 0
          const isFree       = !config.contactOnly && sortedTiers.length === 0
          const isContact    = config.contactOnly
          const usedMonths   = new Set(config.pricingTiers.map(t => t.months))

          return (
            <div key={config.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold px-2 py-0.5 rounded', KEY_COLORS[config.key] ?? 'bg-gray-100 text-gray-700')}>
                    {config.key}
                  </span>
                  <span className="font-semibold text-gray-900">{config.name}</span>
                  {!config.active && <span className="text-xs text-gray-400 italic">inactivo</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditIdx(isEdit ? null : idx)}
                    className={cn('p-1.5 rounded-lg transition-colors', isEdit ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:bg-gray-100')}
                    title="Editar"
                  >
                    <Settings2 size={15} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Remover o plano ${config.name}?`)) deletePlan(idx) }}
                    className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* ── Summary view (not editing) ─────────────────────────────── */}
              {!isEdit && (
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {config.highlight && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        ⭐ Destaque
                      </span>
                    )}
                    {!config.active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{config.description || '—'}</p>

                  {/* Pricing tiers display */}
                  {isFree && (
                    <p className="text-3xl font-bold text-green-600">Grátis</p>
                  )}
                  {isContact && (
                    <p className="text-3xl font-bold text-purple-600">Sob consulta</p>
                  )}
                  {!isFree && !isContact && sortedTiers.length > 0 && (
                    <div className="space-y-1.5">
                      {sortedTiers.map((tier, ti) => {
                        const pct = basePPM > 0 && ti > 0 ? savingsPct(tier, basePPM) : 0
                        return (
                          <div key={tier.months} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <Tag size={13} className="text-gray-400" />
                              <span className="text-sm text-gray-700 font-medium">
                                {tier.label || `${tier.months} meses`}
                              </span>
                              {pct > 0 && (
                                <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                  <TrendingDown size={10} /> -{pct}%
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {fmt(tier.pricePerMonth, config.currency)}/mês
                              </p>
                              {tier.months > 1 && (
                                <p className="text-xs text-gray-400">
                                  {fmt(tier.totalPrice, config.currency)} total
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 pt-1 border-t border-gray-50">
                    <span>Membros: <strong className="text-gray-700">{config.maxMembers === null ? '∞' : config.maxMembers}</strong></span>
                    <span>Raids/mês: <strong className="text-gray-700">{config.maxRaidsPerMonth === null ? '∞' : config.maxRaidsPerMonth}</strong></span>
                    <span>Emails: <strong className={config.emailNotifications ? 'text-green-600' : 'text-gray-400'}>{config.emailNotifications ? 'Sim' : 'Não'}</strong></span>
                  </div>
                </div>
              )}

              {/* ── Edit view ─────────────────────────────────────────────── */}
              {isEdit && (
                <div className="px-5 py-4 space-y-5">

                  {/* Dados básicos */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Informação</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={config.name} onChange={e => updatePlan(idx, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Moeda</label>
                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={config.currency} onChange={e => updatePlan(idx, 'currency', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Descrição</label>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" value={config.description} onChange={e => updatePlan(idx, 'description', e.target.value)} />
                    </div>
                    <div className="flex gap-5 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={config.contactOnly} onChange={e => updatePlan(idx, 'contactOnly', e.target.checked)} />
                        <span className="text-sm text-gray-700">Sob consulta</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={config.highlight} onChange={e => updatePlan(idx, 'highlight', e.target.checked)} />
                        <span className="text-sm text-gray-700">⭐ Destaque (Mais popular)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={config.emailNotifications} onChange={e => updatePlan(idx, 'emailNotifications', e.target.checked)} />
                        <span className="text-sm text-gray-700">Emails incluídos</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded" checked={config.active} onChange={e => updatePlan(idx, 'active', e.target.checked)} />
                        <span className="text-sm text-gray-700">Activo</span>
                      </label>
                    </div>
                  </div>

                  {/* Limites */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Limites</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Máx. membros</label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          placeholder="Ilimitado"
                          value={config.maxMembers ?? ''}
                          onChange={e => updatePlan(idx, 'maxMembers', e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Raids/mês</label>
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          placeholder="Ilimitado"
                          value={config.maxRaidsPerMonth ?? ''}
                          onChange={e => updatePlan(idx, 'maxRaidsPerMonth', e.target.value === '' ? null : Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Funcionalidades (bullets da landing page) */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Funcionalidades na landing page</p>
                    <div className="space-y-1.5">
                      {(config.features ?? []).map((feat, fi) => (
                        <div key={fi} className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="flex-1 border rounded-lg px-2.5 py-1.5 text-sm"
                            value={feat}
                            placeholder="Ex: Até 30 membros"
                            onChange={e => {
                              const next = [...(config.features ?? [])]
                              next[fi] = e.target.value
                              updatePlan(idx, 'features', next)
                            }}
                          />
                          <button
                            onClick={() => updatePlan(idx, 'features', (config.features ?? []).filter((_, i) => i !== fi))}
                            className="text-gray-300 hover:text-red-500 p-1 flex-shrink-0 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => updatePlan(idx, 'features', [...(config.features ?? []), ''])}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors pt-0.5"
                      >
                        <Plus size={12} /> Adicionar funcionalidade
                      </button>
                    </div>
                  </div>

                  {/* Preços por período */}
                  {!config.contactOnly && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preços por período de pagamento</p>
                      <p className="text-xs text-gray-500">
                        Define um preço por mês diferente consoante o cliente pague por mais meses de uma vez.
                        O primeiro período é a referência — os seguintes mostrarão a poupança automaticamente.
                      </p>

                      {/* Tier rows */}
                      {sortedTiers.length > 0 && (
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          {/* Table header */}
                          <div className="grid grid-cols-[90px_1fr_1fr_1fr_32px] gap-2 px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-500">
                            <span>Período</span>
                            <span>Preço/mês</span>
                            <span>Total a pagar</span>
                            <span>Etiqueta</span>
                            <span />
                          </div>

                          {/* Tier rows */}
                          {sortedTiers.map((tier, ti) => {
                            const pct = basePPM > 0 && ti > 0 ? savingsPct(tier, basePPM) : 0
                            // find real index in unsorted array
                            const realTierIdx = config.pricingTiers.indexOf(tier)
                            return (
                              <div key={`${tier.months}-${ti}`} className="grid grid-cols-[90px_1fr_1fr_1fr_32px] gap-2 px-3 py-2 border-t border-gray-100 items-center">
                                {/* Months */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={1}
                                    className="w-12 border rounded px-2 py-1 text-sm text-center"
                                    value={tier.months}
                                    onChange={e => updateTier(idx, realTierIdx, 'months', e.target.value)}
                                  />
                                  <span className="text-xs text-gray-400">m</span>
                                </div>

                                {/* Price per month */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={tier.pricePerMonth}
                                    onChange={e => updateTier(idx, realTierIdx, 'pricePerMonth', e.target.value)}
                                  />
                                  <span className="text-xs text-gray-400 flex-shrink-0">{config.currency}</span>
                                </div>

                                {/* Total */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    value={tier.totalPrice}
                                    onChange={e => updateTier(idx, realTierIdx, 'totalPrice', e.target.value)}
                                  />
                                  <span className="text-xs text-gray-400 flex-shrink-0">{config.currency}</span>
                                </div>

                                {/* Label + savings */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-sm"
                                    placeholder="Anual"
                                    value={tier.label}
                                    onChange={e => updateTier(idx, realTierIdx, 'label', e.target.value)}
                                  />
                                  {pct > 0 && (
                                    <span className="text-xs font-bold text-green-600 flex-shrink-0">-{pct}%</span>
                                  )}
                                </div>

                                {/* Delete */}
                                <button
                                  onClick={() => deleteTier(idx, realTierIdx)}
                                  className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Quick-add buttons */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2">Adicionar período:</p>
                        <div className="flex gap-2 flex-wrap">
                          {QUICK_PERIODS.map(p => (
                            <button
                              key={p.months}
                              disabled={usedMonths.has(p.months)}
                              onClick={() => addTier(idx, p.months, p.label)}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                                usedMonths.has(p.months)
                                  ? 'opacity-30 cursor-not-allowed border-gray-200 text-gray-400'
                                  : 'border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400'
                              )}
                            >
                              <Plus size={10} className="inline mr-0.5" />
                              {p.label}
                            </button>
                          ))}
                          {/* Custom */}
                          <button
                            onClick={() => {
                              const m = parseInt(prompt('Número de meses:') ?? '0')
                              if (m > 0) addTier(idx, m, `${m} meses`)
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-all"
                          >
                            <Plus size={10} className="inline mr-0.5" /> Outro
                          </button>
                        </div>
                      </div>

                      {sortedTiers.length === 0 && !isFree && (
                        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                          Sem períodos definidos — o plano não terá preço visível. Adiciona pelo menos um período acima.
                        </p>
                      )}
                    </div>
                  )}

                  {config.contactOnly && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      Plano "Sob consulta" — não são exibidos preços. O cliente contacta directamente.
                    </p>
                  )}
                </div>
              )}

            </div>
          )
        })}
      </div>

      {/* Floating save bar */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 flex gap-2 bg-white shadow-xl rounded-2xl p-3 border border-gray-200">
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <RotateCcw size={13} /> Reverter
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-60">
            <Save size={13} /> {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      )}

    </div>
  )
}
