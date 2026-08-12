import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Upload, Plus, Pencil, Trash2, Bike, Map, Mail, Copy, Check, Award, Edit2, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge, RaidStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { getMemberStatusLabel, getVehicleTypeLabel, formatShortDate } from '@/lib/utils'

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

const statusColors: Record<string, string> = { ACTIVE: 'success', INACTIVE: 'default', SUSPENDED: 'danger', GUEST: 'info' }

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const photoRef = useRef<HTMLInputElement>(null)
  const vehiclePhotoRef = useRef<HTMLInputElement>(null)
  const [editModal, setEditModal] = useState(false)
  const [vehicleModal, setVehicleModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [uploadingVehicleId, setUploadingVehicleId] = useState<string | null>(null)
  const [inviteModal, setInviteModal] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [certYear, setCertYear] = useState(new Date().getFullYear())
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then((r) => r.data),
  })

  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post(`/members/${id}/photo`, fd)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); toast.success('Foto actualizada!') },
    onError: () => toast.error('Erro ao fazer upload da foto'),
  })

  const editSchema = z.object({
    fullName: z.string().min(2, 'Nome obrigatório'),
    nickname: z.string().optional(),
    memberNumber: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    birthDate: z.string().optional(),
    biNumber: z.string().optional(),
    bloodType: z.string().optional(),
    licenseNumber: z.string().optional(),
    licenseExpiresAt: z.string().optional(),
    emergencyContact: z.string().optional(),
    emergencyPhone: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST']),
    role: z.enum(['ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'CAPTAIN', 'MEMBER', 'GUEST']).optional(),
    notes: z.string().optional(),
  })
  type EditData = z.infer<typeof editSchema>

  const editForm = useForm<EditData>({ resolver: zodResolver(editSchema) })

  const editMutation = useMutation({
    mutationFn: (data: EditData) => api.patch(`/members/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member', id] })
      qc.invalidateQueries({ queryKey: ['members'] })
      setEditModal(false)
      toast.success('Membro actualizado!')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao actualizar'),
  })

  function openEditModal() {
    editForm.reset({
      fullName: member.fullName,
      nickname: member.nickname ?? '',
      memberNumber: member.memberNumber ?? '',
      phone: member.phone ?? '',
      address: member.address ?? '',
      birthDate: member.birthDate ? new Date(member.birthDate).toISOString().split('T')[0] : '',
      biNumber: member.biNumber ?? '',
      bloodType: member.bloodType ?? '',
      licenseNumber: member.licenseNumber ?? '',
      licenseExpiresAt: member.licenseExpiresAt ? new Date(member.licenseExpiresAt).toISOString().split('T')[0] : '',
      emergencyContact: member.emergencyContact ?? '',
      emergencyPhone: member.emergencyPhone ?? '',
      status: member.status,
      role: member.user?.role ?? 'MEMBER',
      notes: member.notes ?? '',
    })
    setEditModal(true)
  }

  const vehicleForm = useForm<VehicleData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { type: 'TRAIL' },
  })

  const addVehicleMutation = useMutation({
    mutationFn: (data: VehicleData) => api.post(`/members/${id}/vehicles`, data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); setVehicleModal(false); vehicleForm.reset({ type: 'TRAIL' }); toast.success('Veículo adicionado!') },
    onError: () => toast.error('Erro ao adicionar veículo'),
  })

  const updateVehicleMutation = useMutation({
    mutationFn: (data: VehicleData) => api.patch(`/members/${id}/vehicles/${editingVehicle.id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); setVehicleModal(false); setEditingVehicle(null); toast.success('Veículo actualizado!') },
    onError: () => toast.error('Erro ao actualizar veículo'),
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: (vehicleId: string) => api.delete(`/members/${id}/vehicles/${vehicleId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); toast.success('Veículo eliminado') },
  })

  const vehiclePhotoMutation = useMutation({
    mutationFn: ({ vehicleId, file }: { vehicleId: string; file: File }) => {
      const fd = new FormData(); fd.append('photo', file)
      return api.post(`/members/${id}/vehicles/${vehicleId}/photo`, fd)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['member', id] }); toast.success('Foto do veículo actualizada!') },
    onError: () => toast.error('Erro ao fazer upload da foto'),
  })

  const certificateMutation = useMutation({
    mutationFn: (year: number) => api.post(`/pdf/members/${id}/certificate`, { year }, { responseType: 'blob' }),
    onSuccess: (r, year) => {
      const disposition = r.headers['content-disposition'] as string | undefined
      const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i)
      const filename = utf8 ? decodeURIComponent(utf8[1].trim()) : `Certificado - ${year}.pdf`
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('Certificado gerado!')
    },
    onError: () => toast.error('Erro ao gerar certificado'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      toast.success('Membro eliminado')
      navigate('/members')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao eliminar membro'),
  })

  const isAdmin = ['ADMIN', 'APP_ADMIN', 'CAPTAIN'].includes(user?.role ?? '')
  const canExportProfile = ['ADMIN', 'APP_ADMIN'].includes(user?.role ?? '')

  const profileMutation = useMutation({
    mutationFn: () => api.post(`/pdf/members/${id}/profile`, {}, { responseType: 'blob' }),
    onSuccess: (r) => {
      const disposition = r.headers['content-disposition'] as string | undefined
      const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i)
      const filename = utf8 ? decodeURIComponent(utf8[1].trim()) : `Ficha - ${member?.fullName ?? 'membro'}.pdf`
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('Ficha gerada!')
    },
    onError: () => toast.error('Erro ao gerar ficha PDF'),
  })

  const inviteMutation = useMutation({
    mutationFn: (email?: string) => api.post(`/members/${id}/invite`, { email: email || undefined }).then((r) => r.data),
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl)
      setInviteModal(true)
      if (data.emailSent) toast.success('Email de convite enviado!')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao gerar convite'),
  })

  function copyInviteUrl() {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return <div className="flex justify-center py-16"><div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} /></div>
  if (!member) return <div className="text-center py-16 text-gray-500">Membro não encontrado</div>

  function openVehicleModal(vehicle?: any) {
    if (vehicle) { setEditingVehicle(vehicle); vehicleForm.reset(vehicle) }
    else { setEditingVehicle(null); vehicleForm.reset({ type: 'TRAIL' }) }
    setVehicleModal(true)
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/members" className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900 truncate">{member.fullName}</h1>
            {member.nickname && <span className="text-sm text-gray-400 flex-shrink-0">"{member.nickname}"</span>}
            <Badge variant={statusColors[member.status] as any}>{getMemberStatusLabel(member.status)}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canExportProfile && (
            <Button size="sm" variant="secondary" onClick={() => profileMutation.mutate()} loading={profileMutation.isPending} title="Exportar ficha PDF">
              <FileDown size={14} /> Ficha PDF
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="secondary" onClick={openEditModal}>
                <Edit2 size={14} /> Editar
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(true)}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Photo + info */}
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
                {isAdmin && (
                  <button
                    onClick={() => photoRef.current?.click()}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <Upload size={13} />
                  </button>
                )}
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
              {member.memberNumber && <p className="text-sm text-gray-500">Membro #{member.memberNumber}</p>}
              {member.user ? (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500">{member.user.email}</p>
                </div>
              ) : isAdmin ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => setInviteModal(true)}
                >
                  <Mail size={13} />
                  Convidar
                </Button>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Sem conta de acesso</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold">Dados pessoais</h3></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {member.phone && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Telemóvel:</span><span>{member.phone}</span></div>}
              {member.address && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Morada:</span><span>{member.address}</span></div>}
              {member.birthDate && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Nascimento:</span><span>{new Date(member.birthDate).toLocaleDateString('pt-AO')}</span></div>}
              {member.biNumber && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">BI / CC:</span><span>{member.biNumber}</span></div>}
              {member.bloodType && (
                <div className="flex gap-2 items-center">
                  <span className="text-gray-500 w-24 flex-shrink-0">Tipo sang.:</span>
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold" style={{ backgroundColor: 'var(--accent)' }}>{member.bloodType}</span>
                </div>
              )}
              {member.licenseNumber && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Carta nº:</span><span>{member.licenseNumber}</span></div>}
              {member.licenseExpiresAt && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 flex-shrink-0">Validade:</span>
                  <span className={new Date(member.licenseExpiresAt) < new Date() ? 'text-red-600 font-medium' : ''}>
                    {new Date(member.licenseExpiresAt).toLocaleDateString('pt-AO')}
                    {new Date(member.licenseExpiresAt) < new Date() && ' ⚠️ expirada'}
                  </span>
                </div>
              )}
              {member.emergencyContact && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Emergência:</span><span>{member.emergencyContact}</span></div>}
              {member.emergencyPhone && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Tel. emerg.:</span><span>{member.emergencyPhone}</span></div>}
              {member.notes && <div className="flex gap-2"><span className="text-gray-500 w-24 flex-shrink-0">Notas:</span><span className="text-gray-600 text-xs">{member.notes}</span></div>}
              {!member.phone && !member.address && !member.emergencyContact && !member.notes && !member.biNumber && !member.bloodType && !member.licenseNumber && (
                <p className="text-xs text-gray-400 italic">Sem dados adicionais. Clica em Editar para preencher.</p>
              )}
            </CardContent>
          </Card>

          {/* Participation stats + certificado */}
          <Card>
            <CardHeader><h3 className="text-sm font-semibold">Participação</h3></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{member.participations?.length ?? 0}</p>
                <p className="text-xs text-gray-500">Raids participados</p>
              </div>
              {isAdmin && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-600">Certificado Anual</p>
                  <div className="flex gap-2">
                    <select
                      value={certYear}
                      onChange={(e) => setCertYear(Number(e.target.value))}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1"
                      style={{ '--tw-ring-color': 'var(--accent)' } as any}
                    >
                      {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={certificateMutation.isPending}
                      onClick={() => certificateMutation.mutate(certYear)}
                    >
                      <Award size={13} />
                      PDF
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Vehicles + Raids */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicles */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Veículos</h3>
                {isAdmin && (
                  <Button size="sm" onClick={() => openVehicleModal()}>
                    <Plus size={14} />
                    Adicionar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!member.vehicles?.length ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum veículo registado.</p>
              ) : (
                <div className="space-y-3">
                  {member.vehicles.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg group">
                      <div className="relative w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {v.photoUrl ? (
                          <img src={v.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Bike size={18} className="text-gray-400" />
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => { setUploadingVehicleId(v.id); vehiclePhotoRef.current?.click() }}
                            className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                            title="Alterar foto"
                          >
                            <Upload size={12} className="text-white" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{v.brand} {v.model} {v.year ? `(${v.year})` : ''}</p>
                        <p className="text-xs text-gray-500">{getVehicleTypeLabel(v.type)} {v.displacement ? `· ${v.displacement} cc` : ''} {v.plate ? `· ${v.plate}` : ''}</p>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <button onClick={() => openVehicleModal(v)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteVehicleMutation.mutate(v.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raid history */}
          <Card>
            <CardHeader><h3 className="font-semibold">Historial de Raids</h3></CardHeader>
            <CardContent>
              {!member.participations?.length ? (
                <p className="text-sm text-gray-500 text-center py-4">Ainda não participou em nenhum raid.</p>
              ) : (
                <div className="space-y-2">
                  {member.participations.map((p: any) => (
                    <Link key={p.id} to={`/raids/${p.raid.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <Map size={16} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{p.raid.title}</p>
                        <p className="text-xs text-gray-500">{formatShortDate(p.raid.date)}</p>
                      </div>
                      <RaidStatusBadge status={p.raid.status} />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Member Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar membro" size="lg">
        <form onSubmit={editForm.handleSubmit(d => editMutation.mutate(d))} className="space-y-5">

          {/* Identificação */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome completo *" error={editForm.formState.errors.fullName?.message} {...editForm.register('fullName')} />
              <Input label="Alcunha" placeholder="Ex: Falcão" {...editForm.register('nickname')} />
              <Input label="Nº de membro" placeholder="042" {...editForm.register('memberNumber')} />
              <Input label="BI / CC / NIF" placeholder="0123456789LA0" {...editForm.register('biNumber')} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo sanguíneo</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" {...editForm.register('bloodType')}>
                  <option value="">— Desconhecido —</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data de nascimento</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" {...editForm.register('birthDate')} />
              </div>
              <Input label="Nº Carta de Condução" placeholder="12345678" {...editForm.register('licenseNumber')} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Validade da carta</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400" {...editForm.register('licenseExpiresAt')} />
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contacto</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Telemóvel" placeholder="+244 9XX XXX XXX" {...editForm.register('phone')} />
              <Input label="Morada" placeholder="Rua, nº, bairro, cidade" {...editForm.register('address')} />
            </div>
          </div>

          {/* Emergência */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergência</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nome do contacto" placeholder="Ex: Maria (esposa)" {...editForm.register('emergencyContact')} />
              <Input label="Telemóvel de emergência" placeholder="+244 9XX XXX XXX" {...editForm.register('emergencyPhone')} />
            </div>
          </div>

          {/* Estado e papel */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Estado no clube</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" {...editForm.register('status')}>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="SUSPENDED">Suspenso</option>
                  <option value="GUEST">Convidado</option>
                </select>
              </div>
              {member.user && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Papel no sistema</label>
                  <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" {...editForm.register('role')}>
                    <option value="MEMBER">Membro</option>
                    <option value="CAPTAIN">Capitão</option>
                    <option value="SECRETARY">Secretário</option>
                    <option value="TREASURER">Tesoureiro</option>
                    <option value="PR">Relações Públicas</option>
                    <option value="DISCIPLINA">Disciplina</option>
                    <option value="VICE_PRESIDENT">Vice-Presidente</option>
                    <option value="ADMIN">Presidente</option>
                    <option value="GUEST">Convidado</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              rows={3}
              placeholder="Observações sobre o membro..."
              {...editForm.register('notes')}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={editMutation.isPending}>Guardar alterações</Button>
          </div>
        </form>
      </Modal>

      {/* Invite Modal */}
      <Modal
        open={inviteModal}
        onClose={() => { setInviteModal(false); setInviteUrl(null); setInviteEmail('') }}
        title="Convidar Membro"
        size="sm"
      >
        <div className="space-y-4">
          {!inviteUrl ? (
            <>
              <p className="text-sm text-gray-600">
                Gera um link de convite para <strong>{member.fullName}</strong> criar a conta de acesso. Válido por 48 horas.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email do membro <span className="text-gray-400 font-normal">(opcional — para envio automático)</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="piloto@email.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white"
                  style={{ '--tw-ring-color': 'var(--accent)' } as any}
                />
              </div>
              <Button
                className="w-full"
                loading={inviteMutation.isPending}
                onClick={() => inviteMutation.mutate(inviteEmail || undefined)}
              >
                <Mail size={15} />
                {inviteEmail ? 'Gerar e enviar por email' : 'Gerar link'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Link gerado para <strong>{member.fullName}</strong>. Expira em 48 horas.
              </p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                <p className="text-xs text-gray-700 flex-1 truncate font-mono">{inviteUrl}</p>
                <button
                  onClick={copyInviteUrl}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors flex-shrink-0"
                >
                  {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                </button>
              </div>
              <Button className="w-full" onClick={copyInviteUrl}>
                {copied ? '✓ Copiado!' : 'Copiar link'}
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Eliminar membro" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tens a certeza que queres eliminar <strong>{member?.fullName}</strong>?
            {member?.user && ' A conta de acesso ao sistema também será eliminada.'}
            {' '}Esta acção não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Eliminar
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
        <form onSubmit={vehicleForm.handleSubmit((d) => editingVehicle ? updateVehicleMutation.mutate(d) : addVehicleMutation.mutate(d))} className="space-y-4">
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
