import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import Step1Basics from './Step1Basics'
import Step2Route from './Step2Route'
import Step3Team from './Step3Team'
import Step4Contingency from './Step4Contingency'

export interface WizardData {
  title: string
  date: string
  origin: string
  destination: string
  difficulty: string
  estimatedKm?: number
  estimatedDuration?: string
  roadTypes: string[]
  description?: string
  maxSpeed?: number
  communicationChannel?: string
  accommodation?: string
  accommodationContact?: string
  routePoints: Array<{
    order: number
    name: string
    type: string
    scheduledDate?: string
    scheduledTime?: string
    kmAccumulated?: number
    stopDuration?: number
    notes?: string
  }>
  participants: Array<{
    memberId: string
    vehicleId?: string
    role: string
  }>
  contingency: {
    accidentText?: string
    breakdownText?: string
    separationText?: string
    weatherText?: string
    rallyPoint?: string
    contactsJson?: any[]
  }
}

const DRAFT_KEY = 'raid-wizard-draft'

const STEPS = [
  { number: 1, label: 'Dados Básicos' },
  { number: 2, label: 'Roteiro' },
  { number: 3, label: 'Equipa' },
  { number: 4, label: 'Contingência' },
]

const EMPTY_DATA: Partial<WizardData> = {
  roadTypes: [],
  routePoints: [],
  participants: [],
  contingency: {},
}

export default function RaidWizard() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEditing = !!id
  const [step, setStep] = useState(1)
  const [data, setData] = useState<Partial<WizardData>>(EMPTY_DATA)
  // Para edição: só renderiza os passos depois dos dados estarem prontos
  const [ready, setReady] = useState(!isEditing)

  // Auto-save: restaura rascunho ao abrir novo raid
  useEffect(() => {
    if (isEditing) return
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return
    try {
      const { _savedAt, ...draftData } = JSON.parse(saved)
      const hasContent = draftData.title || draftData.origin || (draftData.routePoints?.length > 2)
      if (!hasContent) return
      const when = _savedAt ? new Date(_savedAt).toLocaleString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
      toast(
        (t) => (
          <div>
            <p className="font-semibold text-sm text-gray-900 mb-0.5">Rascunho guardado encontrado</p>
            {when && <p className="text-xs text-gray-400 mb-3">Guardado a {when}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setData(draftData); toast.dismiss(t.id); toast.success('Rascunho restaurado!') }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Continuar
              </button>
              <button
                onClick={() => { localStorage.removeItem(DRAFT_KEY); toast.dismiss(t.id) }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Descartar
              </button>
            </div>
          </div>
        ),
        { duration: Infinity, id: 'draft-restore' }
      )
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  // Auto-save: guarda a cada alteração (só em modo criação)
  useEffect(() => {
    if (isEditing) return
    const hasContent = data.title || data.origin || (data.routePoints?.length ?? 0) > 2
    if (!hasContent) return
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, _savedAt: new Date().toISOString() }))
  }, [data, isEditing])

  const clearDraft = useCallback(() => localStorage.removeItem(DRAFT_KEY), [])

  const { data: clubData } = useQuery({
    queryKey: ['club'],
    queryFn: () => api.get('/clubs/me').then((r) => r.data),
  })

  const { data: emergencyContacts = [] } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get('/clubs/me/emergency-contacts').then((r) => r.data),
  })

  const { data: raidData, isLoading: raidLoading } = useQuery({
    queryKey: ['raid', id],
    queryFn: () => api.get(`/raids/${id}`).then((r) => r.data),
    enabled: isEditing,
  })

  // Quando os dados do raid chegam, preenche o estado e liberta a renderização
  useEffect(() => {
    if (!raidData) return
    setData({
      title: raidData.title,
      date: raidData.date?.split('T')[0],
      origin: raidData.origin,
      destination: raidData.destination,
      difficulty: raidData.difficulty,
      estimatedKm: raidData.estimatedKm,
      estimatedDuration: raidData.estimatedDuration,
      roadTypes: raidData.roadTypes ?? [],
      description: raidData.description,
      maxSpeed: raidData.maxSpeed,
      communicationChannel: raidData.communicationChannel,
      accommodation: raidData.accommodation,
      accommodationContact: raidData.accommodationContact,
      routePoints: raidData.routePoints ?? [],
      participants: (raidData.participants ?? []).map((p: any) => ({
        memberId: p.memberId,
        vehicleId: p.vehicleId,
        role: p.role,
      })),
      contingency: raidData.contingencyPlan ? {
        accidentText: raidData.contingencyPlan.accidentText,
        breakdownText: raidData.contingencyPlan.breakdownText,
        separationText: raidData.contingencyPlan.separationText,
        weatherText: raidData.contingencyPlan.weatherText,
        rallyPoint: raidData.contingencyPlan.rallyPoint,
        contactsJson: raidData.contingencyPlan.contactsJson,
      } : {},
    })
    setReady(true)
  }, [raidData])

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      isEditing
        ? api.patch(`/raids/${id}`, payload).then((r) => r.data)
        : api.post('/raids', payload).then((r) => r.data),
    onSuccess: (raid) => {
      clearDraft()
      toast.success(isEditing ? 'Raid actualizado!' : 'Raid criado com sucesso!')
      navigate(`/raids/${raid.id}`)
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao guardar raid'),
  })

  const saveDraftMutation = useMutation({
    mutationFn: (payload: any) =>
      isEditing
        ? api.patch(`/raids/${id}`, { ...payload, status: 'DRAFT' }).then((r) => r.data)
        : api.post('/raids', { ...payload, status: 'DRAFT' }).then((r) => r.data),
    onSuccess: (raid) => {
      clearDraft()
      toast.success('Rascunho guardado!')
      navigate(`/raids/${raid.id}`)
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao guardar rascunho'),
  })

  function updateData(updates: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...updates }))
  }

  function buildPayload(publish: boolean) {
    return { ...data, status: publish ? 'CONFIRMED' : 'DRAFT' }
  }

  function handlePublish() { createMutation.mutate(buildPayload(true)) }
  function handleSaveDraft() { saveDraftMutation.mutate(buildPayload(false)) }

  const defaultSettings = clubData?.defaultSettings ?? {}

  // Mostrar spinner enquanto carrega dados para edição
  if (isEditing && (raidLoading || !ready)) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{isEditing ? `Editar: ${data.title ?? ''}` : 'Novo Raid'}</h1>
          <p className="text-xs text-gray-500">Passo {step} de 4 — {STEPS[step - 1].label}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center">
          {STEPS.map((s, idx) => (
            <div key={s.number} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    s.number < step ? 'text-white' : s.number === step ? 'text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                  style={s.number <= step ? { backgroundColor: 'var(--accent)' } : {}}
                >
                  {s.number < step ? <Check size={12} /> : s.number}
                </div>
                <span className={`hidden sm:block text-xs mt-1 font-medium ${s.number === step ? 'text-gray-900' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1.5 sm:mx-2 sm:mb-5 transition-all" style={{ backgroundColor: s.number < step ? 'var(--accent)' : '#e5e7eb' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo do passo — só renderiza quando ready=true, garantindo que defaultValues estão correctos */}
      <div className="min-h-96">
        {step === 1 && (
          <Step1Basics
            data={data}
            defaultSettings={defaultSettings}
            onNext={(updates) => { updateData(updates); setStep(2) }}
          />
        )}
        {step === 2 && (
          <Step2Route
            data={data}
            onBack={() => setStep(1)}
            onNext={(updates) => { updateData(updates); setStep(3) }}
          />
        )}
        {step === 3 && (
          <Step3Team
            data={data}
            onBack={() => setStep(2)}
            onNext={(updates) => { updateData(updates); setStep(4) }}
          />
        )}
        {step === 4 && (
          <Step4Contingency
            data={data}
            defaultSettings={defaultSettings}
            emergencyContacts={emergencyContacts}
            onBack={() => setStep(3)}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            isSaving={saveDraftMutation.isPending || createMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}
