import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Search, ChevronRight, UserCircle, Bike, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { getMemberStatusLabel } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const memberSchema = z.object({
  fullName: z.string().min(2, 'Nome obrigatório'),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  biNumber: z.string().optional(),
  bloodType: z.string().optional(),
  birthDate: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseExpiresAt: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  memberNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GUEST']),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(8, 'Mínimo 8 caracteres').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'VICE_PRESIDENT', 'TREASURER', 'SECRETARY', 'PR', 'DISCIPLINA', 'CAPTAIN', 'MEMBER', 'GUEST']),
})
type MemberData = z.infer<typeof memberSchema>

const statusColors: Record<string, string> = {
  ACTIVE: 'success', INACTIVE: 'default', SUSPENDED: 'danger', GUEST: 'info'
}

export default function MembersList() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addModal, setAddModal] = useState(false)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', search, statusFilter],
    queryFn: () => api.get('/members', { params: { search: search || undefined, status: statusFilter || undefined } }).then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemberData>({
    resolver: zodResolver(memberSchema),
    defaultValues: { status: 'ACTIVE', role: 'MEMBER' },
  })

  const addMutation = useMutation({
    mutationFn: (data: MemberData) => api.post('/members', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      setAddModal(false)
      reset()
      toast.success('Membro adicionado!')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao adicionar membro'),
  })

  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(user?.role ?? '')

  return (
    <div className="fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Membros</h1>
          <p className="text-sm text-gray-500 mt-0.5">{members.filter((m: any) => m.status === 'ACTIVE').length} activos</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => {
              api.get('/members/export.csv', { responseType: 'blob' }).then((r) => {
                const url = URL.createObjectURL(new Blob([r.data], { type: 'text/csv' }))
                const a = document.createElement('a'); a.href = url; a.download = 'membros.csv'; a.click()
                URL.revokeObjectURL(url)
              }).catch(() => toast.error('Erro ao exportar'))
            }}>
              <FileDown size={14} />
              CSV
            </Button>
            <Button size="sm" onClick={() => setAddModal(true)}>
              <Plus size={15} />
              Adicionar
            </Button>
          </div>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full pl-9 pr-3 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ fontSize: '16px' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none flex-shrink-0"
          style={{ fontSize: '16px' }}
        >
          <option value="">Todos</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
          <option value="SUSPENDED">Suspenso</option>
          <option value="GUEST">Convidado</option>
        </select>
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nenhum membro encontrado.</p>
            {isAdmin && <Button onClick={() => setAddModal(true)}>Adicionar primeiro membro</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((member: any) => (
            <Link key={member.id} to={`/members/${member.id}`}>
              <Card className="active:bg-gray-50 transition-colors">
                <CardContent className="flex items-center gap-3 py-3.5 px-4">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.fullName} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">{member.fullName}</p>
                      {member.memberNumber && <span className="text-xs text-gray-400 flex-shrink-0">#{member.memberNumber}</span>}
                    </div>
                    {member.nickname && <p className="text-xs text-gray-500 truncate">"{member.nickname}"</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusColors[member.status] as any}>
                        {getMemberStatusLabel(member.status)}
                      </Badge>
                      {member.vehicles?.length > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Bike size={11} />
                          {member.vehicles.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar Membro" size="lg">
        <form onSubmit={handleSubmit((d) => addMutation.mutate(d))} className="space-y-4">
          <Input label="Nome completo *" placeholder="João Silva" error={errors.fullName?.message} {...register('fullName')} />

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Alcunha" placeholder="Falcão" {...register('nickname')} />
              <Input label="Nº de membro" placeholder="042" {...register('memberNumber')} />
              <Input label="BI / CC / NIF" placeholder="0123456789LA0" {...register('biNumber')} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo sanguíneo</label>
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:border-red-400" {...register('bloodType')}>
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
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:border-red-400" {...register('birthDate')} />
              </div>
              <Input label="Telefone" placeholder="+244 9XX XXX XXX" {...register('phone')} />
              <Input label="Nº Carta de Condução" placeholder="12345678" {...register('licenseNumber')} />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Validade da carta</label>
                <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:border-red-400" {...register('licenseExpiresAt')} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emergência</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Contacto emergência" placeholder="Ex: Maria (esposa)" {...register('emergencyContact')} />
              <Input label="Tel. emergência" placeholder="+244 9XX XXX XXX" {...register('emergencyPhone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Estado"
              options={[
                { value: 'ACTIVE', label: 'Activo' },
                { value: 'INACTIVE', label: 'Inactivo' },
                { value: 'GUEST', label: 'Convidado' },
              ]}
              {...register('status')}
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Papel no sistema</label>
              <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none" {...register('role')}>
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
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Acesso ao sistema (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" placeholder="joao@clube.pt" error={errors.email?.message} {...register('email')} />
              <Input label="Senha inicial" type="password" placeholder="Mínimo 8 caracteres" error={errors.password?.message} {...register('password')} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" loading={addMutation.isPending}>Adicionar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
