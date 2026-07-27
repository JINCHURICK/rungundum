import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Pencil, UserPlus, Trash2, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { getRoleLabel } from '@/lib/utils'

const ROLES = [
  { value: 'LEADER',   label: 'Capitão de Estrada' },
  { value: 'TAIL',     label: 'Cauda' },
  { value: 'MEMBER',   label: 'Membro' },
  { value: 'MECHANIC', label: 'Mecânico' },
  { value: 'SUPPORT',  label: 'Apoio' },
]

const STATUS_DOT: Record<string, string> = {
  CONFIRMED: 'bg-green-400',
  DECLINED:  'bg-red-400',
  PENDING:   'bg-yellow-400',
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  DECLINED:  'Recusado',
  PENDING:   'Pendente',
}

interface Participant {
  id: string
  role: string
  status: string
  memberId: string
  vehicleId: string | null
  member: { id: string; fullName: string; nickname: string | null; photoUrl: string | null; phone: string | null }
  vehicle: { id: string; brand: string; model: string; plate: string | null } | null
}

interface Props {
  raidId: string
  participants: Participant[]
  isAdmin: boolean
  raidStatus: string
  myMemberId?: string
}

export default function TeamSection({ raidId, participants, isAdmin, raidStatus, myMemberId }: Props) {
  const qc = useQueryClient()
  const [editingP, setEditingP] = useState<Participant | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editVehicleId, setEditVehicleId] = useState<string>('')
  const [addModal, setAddModal] = useState(false)
  const [addMemberId, setAddMemberId] = useState('')
  const [addRole, setAddRole] = useState('MEMBER')
  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmVehicleId, setConfirmVehicleId] = useState('')

  const canEdit = isAdmin && ['DRAFT', 'CONFIRMED'].includes(raidStatus)
  const myParticipant = myMemberId ? participants.find((p) => p.memberId === myMemberId) : null
  const canConfirmSelf = myParticipant?.status === 'PENDING' && ['CONFIRMED', 'IN_PROGRESS'].includes(raidStatus)
  const pendingCount = participants.filter((p) => p.status === 'PENDING').length

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then((r) => r.data),
    enabled: addModal,
  })

  const { data: memberVehicles = [] } = useQuery({
    queryKey: ['member-vehicles', editingP?.memberId],
    queryFn: () => api.get(`/members/${editingP!.memberId}`).then((r) => r.data.vehicles ?? []),
    enabled: !!editingP,
  })

  const { data: myVehicles = [] } = useQuery({
    queryKey: ['member-vehicles-confirm', myParticipant?.memberId],
    queryFn: () => api.get(`/members/${myParticipant!.memberId}`).then((r) => r.data.vehicles ?? []),
    enabled: !!myParticipant && confirmModal,
  })

  const confirmSelfMutation = useMutation({
    mutationFn: ({ participantId, vehicleId }: { participantId: string; vehicleId?: string }) =>
      api.post(`/raids/${raidId}/participants/${participantId}/confirm`, { vehicleId: vehicleId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raid', raidId] })
      setConfirmModal(false)
      toast.success('Presença confirmada! Preenche a tua checklist.')
    },
    onError: () => toast.error('Erro ao confirmar presença'),
  })

  const declineMutation = useMutation({
    mutationFn: (participantId: string) =>
      api.post(`/raids/${raidId}/participants/${participantId}/decline`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', raidId] }); toast.success('Participação recusada') },
    onError: () => toast.error('Erro ao recusar'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, role, vehicleId }: { id: string; role: string; vehicleId: string | null }) =>
      api.patch(`/raids/${raidId}/participants/${id}`, { role, vehicleId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', raidId] }); setEditingP(null); toast.success('Participante actualizado') },
    onError: () => toast.error('Erro ao actualizar'),
  })

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      api.delete(`/raids/${raidId}/participants/${participantId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', raidId] }); toast.success('Participante removido') },
    onError: () => toast.error('Erro ao remover'),
  })

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/raids/${raidId}/participants`, { memberId: addMemberId, role: addRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['raid', raidId] })
      setAddModal(false); setAddMemberId(''); setAddRole('MEMBER')
      toast.success('Participante adicionado')
    },
    onError: () => toast.error('Erro ao adicionar'),
  })

  const remindMutation = useMutation({
    mutationFn: () => api.post(`/raids/${raidId}/participants/remind`),
    onSuccess: (res) => toast.success((res.data as any).message ?? 'Lembretes enviados!'),
    onError: () => toast.error('Erro ao enviar lembretes'),
  })

  const confirmedCount = participants.filter((p) => p.status === 'CONFIRMED').length
  const existingMemberIds = new Set(participants.map((p) => p.memberId))
  const availableMembers = members.filter((m: any) => m.status === 'ACTIVE' && !existingMemberIds.has(m.id))

  function openEdit(p: Participant) {
    setEditRole(p.role)
    setEditVehicleId(p.vehicleId ?? '')
    setEditingP(p)
  }

  function adminConfirm(p: Participant) {
    api.post(`/raids/${raidId}/participants/${p.id}/confirm`, {})
      .then(() => { qc.invalidateQueries({ queryKey: ['raid', raidId] }); toast.success('Confirmado') })
      .catch(() => toast.error('Erro ao confirmar'))
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Equipa</h3>
          <span className="text-sm text-gray-500">{confirmedCount}/{participants.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit && pendingCount > 0 && raidStatus === 'CONFIRMED' && (
            <Button size="sm" variant="secondary" loading={remindMutation.isPending} onClick={() => remindMutation.mutate()}>
              <Bell size={13} />
              Lembrar ({pendingCount})
            </Button>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setAddModal(true)}>
              <UserPlus size={13} />
              Adicionar
            </Button>
          )}
        </div>
      </div>

      {/* Self-confirm banner */}
      {canConfirmSelf && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center justify-between gap-2">
          <p className="text-sm text-yellow-800 font-medium">A tua presença está pendente</p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={() => setConfirmModal(true)}>
              <CheckCircle size={13} />
              Confirmar
            </Button>
            <button
              onClick={() => declineMutation.mutate(myParticipant!.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Recusar"
            >
              <XCircle size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${participants.length ? (confirmedCount / participants.length) * 100 : 0}%`,
            backgroundColor: 'var(--accent)',
          }}
        />
      </div>

      {/* Participant list */}
      <div className="space-y-1">
        {participants.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum participante adicionado.</p>
        )}
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 py-1.5 group">
            {/* Avatar */}
            {p.member.photoUrl ? (
              <img src={p.member.photoUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                {p.member.fullName[0]}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight">
                {p.member.nickname ?? p.member.fullName}
                {p.memberId === myMemberId && <span className="ml-1 text-xs text-gray-400">(tu)</span>}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-500">{getRoleLabel(p.role)}</span>
                {p.vehicle && (
                  <span className="text-xs text-gray-400">· {p.vehicle.brand} {p.vehicle.model}</span>
                )}
              </div>
            </div>

            {/* Status + actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-1" title={STATUS_LABEL[p.status]}>
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status] ?? 'bg-gray-300'}`} />
                <span className="text-xs text-gray-400 hidden sm:inline">{STATUS_LABEL[p.status]}</span>
              </div>

              {canEdit && (
                <div className="flex items-center gap-0.5 ml-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {p.status !== 'CONFIRMED' && (
                    <button
                      title="Confirmar"
                      className="p-1 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                      onClick={() => p.memberId === myMemberId ? setConfirmModal(true) : adminConfirm(p)}
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                  {p.status !== 'DECLINED' && (
                    <button
                      title="Recusar"
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      onClick={() => declineMutation.mutate(p.id)}
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  <button
                    title="Editar"
                    className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    title="Remover"
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => removeMutation.mutate(p.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Self-confirm modal */}
      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirmar Presença" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selecciona a moto que vais usar neste raid.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moto</label>
            <select
              value={confirmVehicleId}
              onChange={(e) => setConfirmVehicleId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
            >
              <option value="">— A definir —</option>
              {myVehicles.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model}{v.plate ? ` (${v.plate})` : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">Após confirmar, preenche a checklist de pré-raid que aparece abaixo.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              loading={confirmSelfMutation.isPending}
              onClick={() => myParticipant && confirmSelfMutation.mutate({ participantId: myParticipant.id, vehicleId: confirmVehicleId })}
            >
              <CheckCircle size={15} />
              Confirmar Presença
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit participant modal */}
      <Modal open={!!editingP} onClose={() => setEditingP(null)} title="Editar Participante" size="sm">
        {editingP && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600 flex-shrink-0">
                {editingP.member.fullName[0]}
              </div>
              <div>
                <p className="font-semibold">{editingP.member.nickname ?? editingP.member.fullName}</p>
                <p className="text-sm text-gray-500">{editingP.member.fullName}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Função no Raid</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moto</label>
              <select
                value={editVehicleId}
                onChange={(e) => setEditVehicleId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
              >
                <option value="">— Sem moto —</option>
                {memberVehicles.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.brand} {v.model}{v.plate ? ` (${v.plate})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setEditingP(null)}>Cancelar</Button>
              <Button
                className="flex-1"
                loading={editMutation.isPending}
                onClick={() => editMutation.mutate({ id: editingP.id, role: editRole, vehicleId: editVehicleId || null })}
              >
                Guardar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add participant modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar Participante" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membro</label>
            <select
              value={addMemberId}
              onChange={(e) => setAddMemberId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
            >
              <option value="">Seleccionar membro...</option>
              {availableMembers.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nickname ? `${m.nickname} (${m.fullName})` : m.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancelar</Button>
            <Button
              className="flex-1"
              disabled={!addMemberId}
              loading={addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
