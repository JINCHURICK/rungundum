import { useState } from 'react'
import { AlertTriangle, Wrench, Radio, CloudRain, MapPin, ChevronDown, ChevronUp, Save, Send, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea, Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import type { WizardData } from './RaidWizard'

interface EmergencyContact {
  id: string
  region: string
  name: string
  role: string
  phone: string
}

interface Props {
  data: Partial<WizardData>
  defaultSettings: any
  emergencyContacts: EmergencyContact[]
  onBack: () => void
  onSaveDraft: () => void
  onPublish: () => void
  isSaving: boolean
}

const SCENARIOS = [
  { key: 'accidentText', icon: AlertTriangle, label: 'Acidente / Queda', color: 'text-red-500', defaultKey: 'accident' },
  { key: 'breakdownText', icon: Wrench, label: 'Avaria de Moto', color: 'text-orange-500', defaultKey: 'breakdown' },
  { key: 'separationText', icon: Radio, label: 'Separação de Piloto', color: 'text-blue-500', defaultKey: 'separation' },
  { key: 'weatherText', icon: CloudRain, label: 'Condições Meteorológicas Adversas', color: 'text-purple-500', defaultKey: 'weather' },
]

export default function Step4Contingency({ data, defaultSettings, emergencyContacts, onBack, onSaveDraft, onPublish, isSaving }: Props) {
  const [expanded, setExpanded] = useState<string | null>('accidentText')
  const [contingency, setContingency] = useState(() => {
    const defaults = defaultSettings?.contingency ?? {}
    return {
      accidentText: data.contingency?.accidentText ?? defaults.accident ?? '',
      breakdownText: data.contingency?.breakdownText ?? defaults.breakdown ?? '',
      separationText: data.contingency?.separationText ?? defaults.separation ?? '',
      weatherText: data.contingency?.weatherText ?? defaults.weather ?? '',
      rallyPoint: data.contingency?.rallyPoint ?? (data.routePoints?.[0]?.name ?? ''),
    }
  })

  // Track selected emergency contact IDs
  const existingIds = new Set(
    ((data.contingency?.contactsJson ?? []) as any[]).map((c: any) => c.id).filter(Boolean)
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(existingIds)

  function updateField(key: string, value: string) {
    setContingency((prev) => ({ ...prev, [key]: value }))
  }

  function toggleContact(contact: EmergencyContact) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(contact.id)) next.delete(contact.id)
      else next.add(contact.id)
      return next
    })
  }

  function buildContingency() {
    const selected = emergencyContacts.filter((c) => selectedIds.has(c.id))
    return { ...contingency, contactsJson: selected }
  }

  function handlePublish() {
    Object.assign(data, { contingency: buildContingency() })
    onPublish()
  }

  function handleSaveDraft() {
    Object.assign(data, { contingency: buildContingency() })
    onSaveDraft()
  }

  // Group contacts by region for display
  const byRegion: Record<string, EmergencyContact[]> = {}
  for (const c of emergencyContacts) {
    if (!byRegion[c.region]) byRegion[c.region] = []
    byRegion[c.region].push(c)
  }
  const regions = Object.keys(byRegion).sort()

  const summary = data

  return (
    <div className="space-y-6">
      {/* Contingency scenarios */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <h3 className="font-semibold text-gray-900 mb-2">Plano de Contingência</h3>
          {SCENARIOS.map(({ key, icon: Icon, label, color }) => (
            <div key={key} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                onClick={() => setExpanded(expanded === key ? null : key)}
              >
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="flex-1 text-sm font-medium">{label}</span>
                {expanded === key ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {expanded === key && (
                <div className="p-4">
                  <Textarea
                    rows={4}
                    placeholder={`Procedimento em caso de ${label.toLowerCase()}...`}
                    value={(contingency as any)[key] ?? ''}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Rally point */}
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
            <MapPin className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">Ponto de Reagrupamento de Emergência</p>
              <Input
                placeholder="Primeiro ponto da rota ou local específico..."
                value={contingency.rallyPoint}
                onChange={(e) => updateField('rallyPoint', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency contacts from club library */}
      {emergencyContacts.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-1">
              <Phone size={15} className="text-gray-500" />
              <h3 className="font-semibold text-gray-900">Contactos de Emergência</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">Selecciona os contactos da biblioteca do clube a incluir neste raid.</p>
            <div className="space-y-4">
              {regions.map((region) => (
                <div key={region}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{region}</p>
                  <div className="space-y-1">
                    {byRegion[region].map((contact) => (
                      <label
                        key={contact.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={() => toggleContact(contact)}
                          className="w-4 h-4 rounded flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-800">{contact.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{contact.role}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-mono flex-shrink-0">{contact.phone}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {selectedIds.size > 0 && (
              <p className="text-xs text-green-600 mt-3 font-medium">{selectedIds.size} contacto(s) seleccionado(s) para este raid</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-4">Resumo do Raid</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Nome:</span><span className="font-medium truncate">{summary.title}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Data:</span><span className="font-medium">{summary.date}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Origem:</span><span className="font-medium truncate">{summary.origin}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Destino:</span><span className="font-medium truncate">{summary.destination}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Distância:</span><span className="font-medium">{summary.estimatedKm ? `${summary.estimatedKm} km` : '—'}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Participantes:</span><span className="font-medium">{summary.participants?.length ?? 0}</span></div>
            <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Pontos:</span><span className="font-medium">{summary.routePoints?.length ?? 0}</span></div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-24 flex-shrink-0">Líder:</span>
              <span className="font-medium">
                {summary.participants?.some((p) => p.role === 'LEADER') ? '✅ Definido' : '⚠️ Não definido'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>← Anterior</Button>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" loading={isSaving} onClick={handleSaveDraft}>
            <Save size={16} />
            Guardar como Rascunho
          </Button>
          <Button type="button" loading={isSaving} onClick={handlePublish}>
            <Send size={16} />
            Publicar e Notificar Membros
          </Button>
        </div>
      </div>
    </div>
  )
}
