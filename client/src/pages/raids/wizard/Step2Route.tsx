import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import type { WizardData } from './RaidWizard'

const ROUTE_TYPES = [
  { value: 'DEPARTURE', label: '🚀 Saída' },
  { value: 'ARRIVAL', label: '🏁 Chegada' },
  { value: 'STOP', label: '📍 Paragem' },
  { value: 'TECH_STOP', label: '🔧 Pausa Técnica' },
  { value: 'BREAKFAST', label: '🥐 Pequeno Almoço' },
  { value: 'LUNCH', label: '🍽️ Almoço' },
  { value: 'COFFEE', label: '☕ Café' },
  { value: 'FUEL', label: '⛽ Abastecimento' },
  { value: 'OVERNIGHT', label: '🏨 Pernoita' },
  { value: 'SCENIC', label: '📸 Ponto Panorâmico' },
  { value: 'BORDER', label: '🛂 Fronteira' },
]

interface Props {
  data: Partial<WizardData>
  onBack: () => void
  onNext: (updates: Partial<WizardData>) => void
}

export default function Step2Route({ data, onBack, onNext }: Props) {
  const [points, setPoints] = useState(() => {
    if (data.routePoints?.length) return data.routePoints
    return [
      { order: 0, name: data.origin ?? '', type: 'DEPARTURE', scheduledDate: '', scheduledTime: '', kmAccumulated: 0, stopDuration: undefined, notes: '' },
      { order: 1, name: data.destination ?? '', type: 'ARRIVAL', scheduledDate: '', scheduledTime: '', kmAccumulated: data.estimatedKm, stopDuration: undefined, notes: '' },
    ]
  })

  function addPoint() {
    const newPoint = { order: points.length - 1, name: '', type: 'STOP', scheduledDate: '', scheduledTime: '', kmAccumulated: undefined, stopDuration: undefined, notes: '' }
    const arr = [...points]
    arr.splice(arr.length - 1, 0, newPoint)
    setPoints(arr.map((p, i) => ({ ...p, order: i })))
  }

  function removePoint(idx: number) {
    if (points[idx].type === 'DEPARTURE' || points[idx].type === 'ARRIVAL') return
    const arr = points.filter((_, i) => i !== idx)
    setPoints(arr.map((p, i) => ({ ...p, order: i })))
  }

  function updatePoint(idx: number, field: string, value: any) {
    setPoints((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function handleNext() {
    const filtered = points.filter((p) => p.name.trim())
    onNext({ routePoints: filtered.map((p, i) => ({ ...p, order: i })) })
  }

  const isFixed = (type: string) => type === 'DEPARTURE' || type === 'ARRIVAL'

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Pontos de Rota</h3>
            <Button type="button" size="sm" variant="secondary" onClick={addPoint}>
              <Plus size={14} />
              <span className="hidden xs:inline">Adicionar </span>Ponto
            </Button>
          </div>

          <div className="space-y-3">
            {points.map((point, idx) => (
              <div
                key={idx}
                className={`rounded-xl border ${isFixed(point.type) ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200'} overflow-hidden`}
              >
                {/* Point header: badge + type select + delete */}
                <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                  <GripVertical size={15} className="text-gray-300 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Select
                      label=""
                      options={ROUTE_TYPES}
                      value={point.type}
                      onChange={(e) => updatePoint(idx, 'type', e.target.value)}
                      disabled={isFixed(point.type)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePoint(idx)}
                    disabled={isFixed(point.type)}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Point fields */}
                <div className="px-3 pb-3 space-y-2">
                  {/* Local — full width */}
                  <Input
                    label="Local *"
                    placeholder="Nome do local ou cidade"
                    value={point.name}
                    onChange={(e) => updatePoint(idx, 'name', e.target.value)}
                  />

                  {/* Data + Hora */}
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <Input
                        label="Data"
                        type="date"
                        value={(point as any).scheduledDate ?? ''}
                        onChange={(e) => updatePoint(idx, 'scheduledDate', e.target.value)}
                      />
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <Input
                        label="Hora"
                        type="time"
                        value={point.scheduledTime ?? ''}
                        onChange={(e) => updatePoint(idx, 'scheduledTime', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* KM + Paragem */}
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        label="KM acumulados"
                        type="number"
                        inputMode="decimal"
                        placeholder="150"
                        value={point.kmAccumulated ?? ''}
                        onChange={(e) => updatePoint(idx, 'kmAccumulated', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        label="Paragem (min)"
                        type="number"
                        inputMode="numeric"
                        placeholder="30"
                        value={point.stopDuration ?? ''}
                        onChange={(e) => updatePoint(idx, 'stopDuration', e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </div>
                  </div>

                  {/* Notas — full width */}
                  <Input
                    label="Notas"
                    placeholder="Observações opcionais..."
                    value={point.notes ?? ''}
                    onChange={(e) => updatePoint(idx, 'notes', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {points.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">
              Clica em "Adicionar Ponto" para começar o roteiro.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-3">
        <Button type="button" variant="secondary" onClick={onBack} className="flex-1 sm:flex-none">← Anterior</Button>
        <Button type="button" onClick={handleNext} className="flex-1 sm:flex-none">Próximo: Equipa →</Button>
      </div>
    </div>
  )
}
