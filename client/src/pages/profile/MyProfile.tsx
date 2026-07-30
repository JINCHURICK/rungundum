import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Bike, Map, ClipboardList, Pencil, LogOut, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { RaidStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { getRoleLabel, formatShortDate } from '@/lib/utils'

const vehicleSchema = z.object({
  brand: z.string().min(1, 'Marca obrigatória'),
  model: z.string().min(1, 'Modelo obrigatório'),
  year: z.coerce.number().int().optional(),
  plate: z.string().optional(),
  type: z.enum(['TRAIL', 'ROAD', 'CUSTOM', 'SCOOTER', 'SUPPORT', 'OTHER']),
  displacement: z.coerce.number().int().optional(),
  notes: z.string().optional(),
})
type VehicleData = z.infer<typeof vehicleSchema>

export default function MyProfile() {
  const { user, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  async function handleLogout() {
    try { await api.post('/auth/logout', { refreshToken }) } catch {}
    logout()
    navigate('/login')
    toast.success('Sessão terminada')
  }
  const photoRef = useRef<HTMLInputElement>(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ nickname: '', phone: '', emergencyContact: '', emergencyPhone: '' })
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwError, setPwError] = useState('')
  const [vehicleModal, setVehicleModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null)
  const vehiclePhotoRef = useRef<HTMLInputElement>(null)

  const vehicleForm = useForm<VehicleData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { type: 'TRAIL' },
  })

  const { data: member, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get(`/members/${user!.memberId}`).then((r) => r.data),
    enabled: !!user?.memberId,
  })

  const editMutation = useMutation({
    mutationFn: () => api.patch('/members/me', editForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); setEditModal(false); toast.success('Perfil actualizado!') },
    onError: () => toast.error('Erro ao actualizar perfil'),
  })

  const pwMutation = useMutation({
    mutationFn: () => api.patch('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    onSuccess: () => {
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPwError('')
      toast.success('Password alterada!')
    },
    onError: (err: any) => setPwError(err.response?.data?.error ?? 'Erro ao alterar password'),
  })

  const memberId = user?.memberId

  const addVehicleMutation = useMutation({
    mutationFn: (data: VehicleData) => api.post(`/members/${memberId}/vehicles`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); setVehicleModal(false); vehicleForm.reset({ type: 'TRAIL' }); toast.success('Veículo adicionado!') },
    onError: () => toast.error('Erro ao adicionar veículo'),
  })

  const updateVehicleMutation = useMutation({
    mutationFn: (data: VehicleData) => api.patch(`/members/${memberId}/vehicles/${editingVehicle.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); setVehicleModal(false); setEditingVehicle(null); toast.success('Veículo actualizado!') },
    onError: () => toast.error('Erro ao actualizar veículo'),
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: (vehicleId: string) => api.delete(`/members/${memberId}/vehicles/${vehicleId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); toast.success('Veículo eliminado') },
    onError: () => toast.error('Erro ao eliminar veículo'),
  })

  const vehiclePhotoMutation = useMutation({
    mutationFn: ({ vehicleId, file }: { vehicleId: string; file: File }) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post(`/members/${memberId}/vehicles/${vehicleId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); toast.success('Foto do veículo actualizada!') },
    onError: () => toast.error('Erro ao fazer upload da foto'),
  })

  function openVehicleModal(vehicle?: any) {
    if (vehicle) { setEditingVehicle(vehicle); vehicleForm.reset(vehicle) }
    else { setEditingVehicle(null); vehicleForm.reset({ type: 'TRAIL' }) }
    setVehicleModal(true)
  }

  function handlePwSubmit() {
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('As passwords não coincidem'); return }
    if (pwForm.newPassword.length < 8) { setPwError('Nova password: mínimo 8 caracteres'); return }
    pwMutation.mutate()
  }

  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post(`/members/${user!.memberId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile'] }); toast.success('Foto actualizada!') },
    onError: () => toast.error('Erro ao fazer upload da foto'),
  })

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  )

  if (!user?.memberId || !member) return (
    <div className="text-center py-16 text-gray-500">
      <p className="font-medium mb-1">Sem perfil de membro associado</p>
      <p className="text-sm text-gray-400">Contacta o administrador do clube.</p>
    </div>
  )

  const confirmedRaids = member.participations?.filter((p: any) => p.status === 'CONFIRMED' || p.raid.status === 'COMPLETED') ?? []
  const totalParticipations = member.participations?.length ?? 0

  return (
    <div className="fade-in space-y-6">
      <h1 className="text-lg font-bold text-gray-900">O meu Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Photo + info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="text-center py-6">
              <div className="relative inline-block mb-4">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.fullName} className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-300">{member.fullName[0]}</span>
                  </div>
                )}
                <button
                  onClick={() => photoRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                  title="Alterar foto"
                >
                  <Upload size={13} />
                </button>
              </div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) photoMutation.mutate(f) }} />
              <input
                ref={vehiclePhotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f && uploadingVehicleId) vehiclePhotoMutation.mutate({ vehicleId: uploadingVehicleId, file: f })
                  e.currentTarget.value = ''
                }}
              />
              <p className="font-bold text-gray-900">{member.fullName}</p>
              {member.nickname && <p className="text-sm text-gray-500">"{member.nickname}"</p>}
              {member.memberNumber && <p className="text-xs text-gray-400 mt-1">Membro #{member.memberNumber}</p>}
              <div className="mt-2">
                <span className="text-xs text-gray-400">{user.email}</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="mt-4"
                onClick={() => {
                  setEditForm({
                    nickname: member.nickname ?? '',
                    phone: member.phone ?? '',
                    emergencyContact: member.emergencyContact ?? '',
                    emergencyPhone: member.emergencyPhone ?? '',
                  })
                  setEditModal(true)
                }}
              >
                <Pencil size={13} /> Editar perfil
              </Button>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{totalParticipations}</p>
                <p className="text-xs text-gray-500 mt-0.5">Raids</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <p className="text-2xl font-bold text-green-600">{confirmedRaids.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Confirmados</p>
              </CardContent>
            </Card>
          </div>

          {/* Contacts */}
          {(member.phone || member.emergencyContact) && (
            <Card>
              <CardHeader><h3 className="text-sm font-semibold">Contactos</h3></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {member.phone && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">Telefone:</span>
                    <span>{member.phone}</span>
                  </div>
                )}
                {member.emergencyContact && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">Emergência:</span>
                    <span>{member.emergencyContact}</span>
                  </div>
                )}
                {member.emergencyPhone && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">Tel. emerg.:</span>
                    <span>{member.emergencyPhone}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logout — visible on mobile since sidebar is hidden */}
          <button
            onClick={handleLogout}
            className="lg:hidden w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <LogOut size={15} />
            Terminar Sessão
          </button>
        </div>

        {/* Right — Vehicles + Raids */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicles */}
          <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bike size={15} className="text-gray-500" />
                    <h3 className="font-semibold text-sm">As minhas Motos</h3>
                  </div>
                  <button
                    onClick={() => openVehicleModal()}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {!member.vehicles?.length ? (
                  <p className="text-sm text-gray-400 text-center py-4">Ainda não tens motos registadas.</p>
                ) : (
                <div className="space-y-3">
                  {member.vehicles.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group">
                      <button
                        type="button"
                        onClick={() => { setUploadingVehicleId(v.id); vehiclePhotoRef.current?.click() }}
                        className="relative w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden"
                        title="Alterar foto"
                      >
                        {v.photoUrl ? (
                          <img src={v.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Bike size={16} className="text-gray-400" />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Upload size={11} className="text-white" />
                        </div>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{v.brand} {v.model}{v.year ? ` (${v.year})` : ''}</p>
                        <p className="text-xs text-gray-500">
                          {v.displacement ? `${v.displacement} cc` : ''}
                          {v.plate ? ` · ${v.plate}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openVehicleModal(v)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteVehicleMutation.mutate(v.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>

          {/* Raid history */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Map size={15} className="text-gray-500" />
                <h3 className="font-semibold text-sm">Historial de Raids</h3>
              </div>
            </CardHeader>
            <CardContent>
              {!member.participations?.length ? (
                <p className="text-sm text-gray-400 text-center py-6">Ainda não participaste em nenhum raid.</p>
              ) : (
                <div className="space-y-1">
                  {member.participations.map((p: any) => {
                    const checkedItems = p.checklistItems?.filter((i: any) => i.checked).length ?? 0
                    const totalItems = p.checklistItems?.length ?? 0
                    const checklistDone = totalItems > 0 && checkedItems === totalItems

                    return (
                      <Link
                        key={p.id}
                        to={`/raids/${p.raid.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{p.raid.title}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0">{getRoleLabel(p.role)}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{formatShortDate(p.raid.date)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {totalItems > 0 && (
                            <div className="flex items-center gap-1" title={`Checklist ${checkedItems}/${totalItems}`}>
                              <ClipboardList size={12} className={checklistDone ? 'text-green-500' : 'text-gray-300'} />
                              <span className="text-xs text-gray-400">{checkedItems}/{totalItems}</span>
                            </div>
                          )}
                          <RaidStatusBadge status={p.raid.status} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar Perfil" size="sm">
        <div className="space-y-4">
          <Input
            label="Alcunha"
            placeholder="Como te chamam no clube"
            value={editForm.nickname}
            onChange={(e) => setEditForm((f) => ({ ...f, nickname: e.target.value }))}
          />
          <Input
            label="Telefone"
            type="tel"
            placeholder="+351 912 345 678"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Contacto de emergência"
            placeholder="Nome do contacto"
            value={editForm.emergencyContact}
            onChange={(e) => setEditForm((f) => ({ ...f, emergencyContact: e.target.value }))}
          />
          <Input
            label="Telefone de emergência"
            type="tel"
            placeholder="+351 912 345 678"
            value={editForm.emergencyPhone}
            onChange={(e) => setEditForm((f) => ({ ...f, emergencyPhone: e.target.value }))}
          />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={editMutation.isPending} onClick={() => editMutation.mutate()}>Guardar</Button>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Alterar password</p>
            <Input
              label="Password atual"
              type="password"
              autoComplete="current-password"
              placeholder="Password atual"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
            <Input
              label="Nova password"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            <Input
              label="Confirmar nova password"
              type="password"
              autoComplete="new-password"
              placeholder="Repetir nova password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
            {pwError && <p className="text-xs text-red-600">{pwError}</p>}
            <Button
              variant="secondary"
              className="w-full"
              loading={pwMutation.isPending}
              disabled={!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword}
              onClick={handlePwSubmit}
            >
              Alterar password
            </Button>
          </div>
        </div>
      </Modal>

      {/* Vehicle Modal */}
      <Modal
        open={vehicleModal}
        onClose={() => { setVehicleModal(false); setEditingVehicle(null) }}
        title={editingVehicle ? 'Editar Veículo' : 'Adicionar Veículo'}
      >
        <form
          onSubmit={vehicleForm.handleSubmit((d) =>
            editingVehicle ? updateVehicleMutation.mutate(d) : addVehicleMutation.mutate(d)
          )}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Marca *" placeholder="Honda" error={vehicleForm.formState.errors.brand?.message} {...vehicleForm.register('brand')} />
            <Input label="Modelo *" placeholder="Africa Twin" error={vehicleForm.formState.errors.model?.message} {...vehicleForm.register('model')} />
            <Input label="Ano" type="number" placeholder="2022" {...vehicleForm.register('year')} />
            <Input label="Matrícula" placeholder="00-AA-00" {...vehicleForm.register('plate')} />
            <Select
              label="Tipo"
              options={[
                { value: 'TRAIL', label: 'Trail' }, { value: 'ROAD', label: 'Estradeira' },
                { value: 'CUSTOM', label: 'Custom' }, { value: 'SCOOTER', label: 'Scooter' },
                { value: 'SUPPORT', label: 'Apoio' }, { value: 'OTHER', label: 'Outro' },
              ]}
              {...vehicleForm.register('type')}
            />
            <Input label="Cilindrada (cc)" type="number" placeholder="1000" {...vehicleForm.register('displacement')} />
          </div>
          <Textarea label="Notas técnicas" placeholder="Pneus novos, corrente a substituir..." rows={2} {...vehicleForm.register('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setVehicleModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={addVehicleMutation.isPending || updateVehicleMutation.isPending}>
              {editingVehicle ? 'Guardar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
