import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import type { WizardData } from './RaidWizard'
import { api } from '@/lib/api'

const ROLES = [
  { value: 'LEADER', label: 'Líder', icon: '👑' },
  { value: 'TAIL', label: 'Cauda', icon: '🔴' },
  { value: 'MECHANIC', label: 'Mecânico', icon: '🔧' },
  { value: 'SUPPORT', label: 'Apoio', icon: '🚐' },
  { value: 'MEMBER', label: 'Membro', icon: '🏍️' },
]

interface Props {
  data: Partial<WizardData>
  onBack: () => void
  onNext: (updates: Partial<WizardData>) => void
}

export default function Step3Team({ data, onBack, onNext }: Props) {
  const [selected, setSelected] = useState<Array<{ memberId: string; vehicleId?: string; role: string }>>(
    data.participants ?? []
  )

  const { data: members = [] } = useQuery({
    queryKey: ['members', 'active'],
    queryFn: () => api.get('/members', { params: { status: 'ACTIVE' } }).then((r) => r.data),
  })

  function isMemberSelected(memberId: string) {
    return selected.some((p) => p.memberId === memberId)
  }

  function toggleMember(member: any) {
    if (isMemberSelected(member.id)) {
      setSelected((prev) => prev.filter((p) => p.memberId !== member.id))
    } else {
      setSelected((prev) => [...prev, { memberId: member.id, role: 'MEMBER' }])
    }
  }

  function updateParticipant(memberId: string, field: string, value: string) {
    setSelected((prev) => prev.map((p) => p.memberId === memberId ? { ...p, [field]: value } : p))
  }

  function getParticipant(memberId: string) {
    return selected.find((p) => p.memberId === memberId)
  }

  function handleNext() {
    const hasLeader = selected.some((p) => p.role === 'LEADER')
    if (!hasLeader && selected.length > 0) {
      const confirmed = window.confirm('Nenhum Líder definido. Deseja continuar assim mesmo?')
      if (!confirmed) return
    }
    onNext({ participants: selected })
  }

  // Group participants in convoy order: Leader, Members, Tail
  const leaderParticipants = selected.filter((p) => p.role === 'LEADER')
  const memberParticipants = selected.filter((p) => !['LEADER', 'TAIL'].includes(p.role))
  const tailParticipants = selected.filter((p) => p.role === 'TAIL')
  const convoy = [...leaderParticipants, ...memberParticipants, ...tailParticipants]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member selection */}
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Seleccionar Membros
              <span className="ml-2 text-sm font-normal text-gray-500">({selected.length} seleccionados)</span>
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {members.map((member: any) => {
                const isSelected = isMemberSelected(member.id)
                const participant = getParticipant(member.id)
                return (
                  <div key={member.id} className={`rounded-xl border-2 transition-all ${isSelected ? 'border-opacity-40' : 'border-gray-100 bg-gray-50'}`}
                    style={isSelected ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 5%, white)' } : {}}>
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => toggleMember(member)}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected ? 'border-transparent text-white' : 'border-gray-300'}`}
                        style={isSelected ? { backgroundColor: 'var(--accent)' } : {}}>
                        {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.fullName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                          {member.fullName[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.fullName}</p>
                        {member.nickname && <p className="text-xs text-gray-500">"{member.nickname}"</p>}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="px-3 pb-3 flex gap-3" onClick={(e) => e.stopPropagation()}>
                        <Select
                          options={ROLES.map((r) => ({ value: r.value, label: `${r.icon} ${r.label}` }))}
                          value={participant?.role ?? 'MEMBER'}
                          onChange={(e) => updateParticipant(member.id, 'role', e.target.value)}
                          className="flex-1"
                        />
                        {member.vehicles?.length > 0 && (
                          <Select
                            options={[
                              { value: '', label: 'Moto padrão' },
                              ...member.vehicles.map((v: any) => ({ value: v.id, label: `${v.brand} ${v.model}` })),
                            ]}
                            value={participant?.vehicleId ?? ''}
                            onChange={(e) => updateParticipant(member.id, 'vehicleId', e.target.value)}
                            className="flex-1"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {members.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum membro activo encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Convoy preview */}
        <Card>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-gray-900 mb-4">Formação em Comboio</h3>
            {convoy.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Seleccione membros para ver a formação.</p>
            ) : (
              <div className="space-y-2">
                {convoy.map((p, idx) => {
                  const member = members.find((m: any) => m.id === p.memberId)
                  const role = ROLES.find((r) => r.value === p.role)
                  const isLeader = p.role === 'LEADER'
                  const isTail = p.role === 'TAIL'
                  return (
                    <div
                      key={p.memberId}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
                        isLeader ? 'border-2 font-semibold' : isTail ? 'border-2 border-dashed' : 'bg-gray-50'
                      }`}
                      style={isLeader ? { borderColor: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 5%, white)' } : isTail ? { borderColor: '#6b7280' } : {}}
                    >
                      <span className="text-lg">{role?.icon ?? '🏍️'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{member?.nickname ?? member?.fullName}</p>
                        <p className="text-xs text-gray-500">{role?.label}</p>
                      </div>
                      <span className="text-xs text-gray-400">#{idx + 1}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>← Anterior</Button>
        <Button type="button" onClick={handleNext}>Próximo: Contingência →</Button>
      </div>
    </div>
  )
}
