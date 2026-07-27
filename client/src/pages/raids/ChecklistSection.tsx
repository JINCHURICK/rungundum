import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { getRoleLabel } from '@/lib/utils'

interface ChecklistItem {
  id: string
  category: string
  label: string
  checked: boolean
}

interface Participant {
  id: string
  role: string
  status: string
  member: { fullName: string; nickname: string | null; photoUrl: string | null }
  checklistItems: ChecklistItem[]
}

const CATEGORY_ORDER = ['Mecânica', 'Equipamento Pessoal', 'Documentação']

export default function ChecklistSection({ raidId, participants }: { raidId: string; participants: Participant[] }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)

  const confirmed = participants.filter((p) => p.status === 'CONFIRMED')

  const mutation = useMutation({
    mutationFn: ({ participantId, items }: { participantId: string; items: { id: string; checked: boolean }[] }) =>
      api.patch(`/raids/${raidId}/participants/${participantId}/checklist`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['raid', raidId] }),
    onError: () => toast.error('Erro ao actualizar checklist'),
  })

  function toggle(participantId: string, item: ChecklistItem) {
    mutation.mutate({ participantId, items: [{ id: item.id, checked: !item.checked }] })
  }

  const completeCount = confirmed.filter((p) => {
    const items = p.checklistItems
    return items.length > 0 && items.every((i) => i.checked)
  }).length

  if (confirmed.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-gray-500" />
            <h3 className="font-semibold text-sm">Checklist de Pré-Raid</h3>
          </div>
          <span className="text-sm text-gray-500">{completeCount}/{confirmed.length} completos</span>
        </div>
        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${confirmed.length ? (completeCount / confirmed.length) * 100 : 0}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0 divide-y divide-gray-50">
        {confirmed.map((p) => {
          const items = p.checklistItems
          const checkedCount = items.filter((i) => i.checked).length
          const total = items.length
          const isComplete = total > 0 && checkedCount === total
          const isOpen = expanded === p.id

          const byCategory: Record<string, ChecklistItem[]> = {}
          for (const item of items) {
            if (!byCategory[item.category]) byCategory[item.category] = []
            byCategory[item.category].push(item)
          }
          const cats = CATEGORY_ORDER.filter((c) => byCategory[c])

          return (
            <div key={p.id}>
              {/* Row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : p.id)}
              >
                {/* Avatar */}
                {p.member.photoUrl ? (
                  <img src={p.member.photoUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                    {p.member.fullName[0]}
                  </div>
                )}

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{p.member.nickname ?? p.member.fullName}</p>
                    <span className="text-xs text-gray-400">{getRoleLabel(p.role)}</span>
                    {isComplete && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        ✓ Completo
                      </span>
                    )}
                  </div>
                  {total > 0 ? (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${(checkedCount / total) * 100}%`,
                            backgroundColor: isComplete ? '#16a34a' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">
                        {checkedCount}/{total}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">Sem itens</p>
                  )}
                </div>

                {isOpen
                  ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                  : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
              </button>

              {/* Expanded items */}
              {isOpen && (
                <div className="bg-gray-50 px-4 pb-4">
                  {total === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Checklist não disponível — participante ainda não confirmou presença.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {cats.map((cat) => (
                        <div key={cat}>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pt-3 mb-2">
                            {cat}
                          </p>
                          <div className="space-y-1">
                            {byCategory[cat].map((item) => (
                              <button
                                key={item.id}
                                className="w-full flex items-center gap-3 py-1.5 text-left group"
                                onClick={() => toggle(p.id, item)}
                                disabled={mutation.isPending}
                              >
                                {/* Checkbox */}
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                                    item.checked
                                      ? 'bg-green-500 border-green-500'
                                      : 'border-gray-300 group-hover:border-gray-500 bg-white'
                                  }`}
                                >
                                  {item.checked && (
                                    <svg viewBox="0 0 10 8" className="w-2.5 h-2">
                                      <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span
                                  className={`text-sm transition-colors ${
                                    item.checked ? 'line-through text-gray-400' : 'text-gray-700'
                                  }`}
                                >
                                  {item.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
