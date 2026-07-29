import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Upload, Plus, Trash2, Save, Pencil, Hand } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'

const schema = z.object({
  name: z.string().min(2),
  acronym: z.string().min(1).max(10),
  location: z.string().min(1),
  country: z.string().optional(),
  motto: z.string().optional(),
  website: z.string().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  statutesText: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const contactSchema = z.object({
  region: z.string().min(1, 'Região obrigatória'),
  name: z.string().min(1, 'Nome obrigatório'),
  role: z.string().min(1, 'Função obrigatória'),
  phone: z.string().min(1, 'Telefone obrigatório'),
})
type ContactData = z.infer<typeof contactSchema>

const handSignalSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório').max(100),
  description: z.string().optional(),
})
type HandSignalData = z.infer<typeof handSignalSchema>

export default function ClubConfig() {
  const { setAuth, user, club: authClub, accessToken, refreshToken } = useAuthStore()
  const qc = useQueryClient()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [contactModal, setContactModal] = useState(false)
  const [signalModal, setSignalModal] = useState(false)
  const [editingSignal, setEditingSignal] = useState<any>(null)
  const signalImageRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const { data: club, isLoading } = useQuery({
    queryKey: ['club'],
    queryFn: () => api.get('/clubs/me').then((r) => r.data),
  })

  const { data: contacts = [] } = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: () => api.get('/clubs/me/emergency-contacts').then((r) => r.data),
  })

  const { data: handSignals = [] } = useQuery({
    queryKey: ['hand-signals'],
    queryFn: () => api.get('/clubs/me/hand-signals').then((r) => r.data),
  })

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const accentColor = watch('accentColor')

  useEffect(() => {
    if (club) reset({ ...club })
  }, [club, reset])

  useEffect(() => {
    if (accentColor) document.documentElement.style.setProperty('--accent', accentColor)
  }, [accentColor])

  const updateMutation = useMutation({
    mutationFn: (data: FormData) => api.patch('/clubs/me', data).then((r) => r.data),
    onSuccess: (updatedClub) => {
      qc.invalidateQueries({ queryKey: ['club'] })
      // Update auth store with new club data
      if (user && accessToken && refreshToken) {
        setAuth({ accessToken, refreshToken, user, club: { id: updatedClub.id, name: updatedClub.name, acronym: updatedClub.acronym, accentColor: updatedClub.accentColor, logoUrl: updatedClub.logoUrl } })
      }
      toast.success('Configurações guardadas!')
    },
    onError: () => toast.error('Erro ao guardar configurações'),
  })

  const logoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('logo', file)
      return api.post('/clubs/me/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data)
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['club'] })
      // Actualiza o auth store para que o header/sidebar mostre o logo imediatamente
      if (user && accessToken && refreshToken && authClub) {
        setAuth({ accessToken, refreshToken, user, club: { ...authClub, logoUrl: data.logoUrl } })
      }
      toast.success('Logo actualizado!')
    },
    onError: () => toast.error('Erro ao fazer upload do logo'),
  })

  const addContactMutation = useMutation({
    mutationFn: (data: ContactData) => api.post('/clubs/me/emergency-contacts', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergency-contacts'] }); setContactModal(false); toast.success('Contacto adicionado!') },
    onError: () => toast.error('Erro ao adicionar contacto'),
  })

  const deleteContactMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clubs/me/emergency-contacts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emergency-contacts'] }); toast.success('Contacto eliminado') },
  })

  const contactForm = useForm<ContactData>({ resolver: zodResolver(contactSchema) })

  const addSignalMutation = useMutation({
    mutationFn: (data: HandSignalData) => api.post('/clubs/me/hand-signals', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hand-signals'] }); setSignalModal(false); toast.success('Sinal adicionado!') },
    onError: () => toast.error('Erro ao adicionar sinal'),
  })

  const updateSignalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HandSignalData }) => api.patch(`/clubs/me/hand-signals/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hand-signals'] }); setSignalModal(false); setEditingSignal(null); toast.success('Sinal actualizado!') },
    onError: () => toast.error('Erro ao actualizar sinal'),
  })

  const deleteSignalMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clubs/me/hand-signals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hand-signals'] }); toast.success('Sinal eliminado') },
  })

  const signalImageMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData(); fd.append('image', file)
      return api.post(`/clubs/me/hand-signals/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hand-signals'] }); toast.success('Imagem actualizada!') },
    onError: () => toast.error('Erro ao fazer upload da imagem'),
  })

  const signalForm = useForm<HandSignalData>({ resolver: zodResolver(handSignalSchema) })

  function openSignalModal(signal?: any) {
    if (signal) { setEditingSignal(signal); signalForm.reset({ name: signal.name, description: signal.description ?? '' }) }
    else { setEditingSignal(null); signalForm.reset({ name: '', description: '' }) }
    setSignalModal(true)
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} /></div>

  return (
    <div className="fade-in space-y-6">
      <PageHeader title="Configurações do Clube" subtitle="Identidade visual, dados gerais e configurações padrão dos raids." />

      <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">
        {/* Logo & Identity */}
        <Card>
          <CardHeader><h3 className="font-semibold">Identidade Visual</h3></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex-shrink-0">
                {club?.logoUrl ? (
                  <img src={club.logoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Logo do clube</p>
                <p className="text-xs text-gray-500 mb-3">PNG ou SVG, fundo transparente recomendado, máx. 5 MB</p>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) logoMutation.mutate(f) }} />
                <Button type="button" variant="secondary" size="sm" loading={logoMutation.isPending} onClick={() => logoInputRef.current?.click()}>
                  <Upload size={14} />
                  {club?.logoUrl ? 'Alterar logo' : 'Fazer upload'}
                </Button>
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cor de destaque</label>
              <div className="flex items-center gap-3">
                <input type="color" className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5" {...register('accentColor')} />
                <Input placeholder="#dc2626" {...register('accentColor')} error={errors.accentColor?.message} className="w-36" />
                <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: accentColor ?? 'var(--accent)' }}>Preview</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General data */}
        <Card>
          <CardHeader><h3 className="font-semibold">Dados Gerais</h3></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Nome oficial do clube" placeholder="Moto Clube..." error={errors.name?.message} {...register('name')} className="sm:col-span-2" />
              <Input label="Sigla / Acrónimo" placeholder="MCX" error={errors.acronym?.message} {...register('acronym')} />
              <Input label="Localidade / País" placeholder="Luanda, Angola" error={errors.location?.message} {...register('location')} />
              <Input label="Lema / Motto" placeholder="Sempre na Estrada" {...register('motto')} />
              <Input label="Website" placeholder="https://meuclube.pt" {...register('website')} />
            </div>
          </CardContent>
        </Card>

        {/* Statutes */}
        <Card>
          <CardHeader><h3 className="font-semibold">Estatuto e Regulamento Interno</h3></CardHeader>
          <CardContent>
            <Textarea
              label="Texto do estatuto"
              placeholder="Insira o texto do estatuto e regulamento interno do clube..."
              rows={8}
              hint="Este texto pode ser incluído nos PDFs dos raids (activado por toggle em cada raid)."
              {...register('statutesText')}
            />
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button type="submit" loading={updateMutation.isPending} disabled={!isDirty}>
            <Save size={16} />
            Guardar Configurações
          </Button>
        </div>
      </form>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Contactos de Emergência</h3>
            <Button size="sm" onClick={() => setContactModal(true)}>
              <Plus size={14} />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum contacto de emergência adicionado. Adicione hospitais, bombeiros e polícia das regiões onde realiza raids.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b">
                    <th className="pb-2 text-left">Região</th>
                    <th className="pb-2 text-left">Nome</th>
                    <th className="pb-2 text-left">Função</th>
                    <th className="pb-2 text-left">Telefone</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {contacts.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2.5 font-medium">{c.region}</td>
                      <td className="py-2.5">{c.name}</td>
                      <td className="py-2.5 text-gray-500">{c.role}</td>
                      <td className="py-2.5">{c.phone}</td>
                      <td className="py-2.5 text-right">
                        <button onClick={() => deleteContactMutation.mutate(c.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sinais de Mão */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hand size={16} className="text-gray-500" />
              <h3 className="font-semibold">Sinais de Mão</h3>
            </div>
            <Button size="sm" onClick={() => openSignalModal()}>
              <Plus size={14} />
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Lista de sinais usados em comboio. Aparecem no PDF do raid.</p>
        </CardHeader>
        <CardContent>
          {handSignals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum sinal de mão configurado. Adicione os sinais usados pelo clube em comboio.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {handSignals.map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl bg-gray-50">
                  {/* Imagem / placeholder */}
                  <div className="flex-shrink-0">
                    {s.imageUrl ? (
                      <img src={s.imageUrl} alt={s.name} className="w-14 h-14 rounded-lg object-cover border border-gray-200" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                        <Hand size={20} className="text-gray-300" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={(el) => { signalImageRefs.current[s.id] = el }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) signalImageMutation.mutate({ id: s.id, file: f }) }}
                    />
                    <button
                      onClick={() => signalImageRefs.current[s.id]?.click()}
                      className="mt-1 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Upload size={11} className="inline mr-0.5" />foto
                    </button>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>}
                  </div>
                  {/* Acções */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => openSignalModal(s)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteSignalMutation.mutate(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signal modal */}
      <Modal
        open={signalModal}
        onClose={() => { setSignalModal(false); setEditingSignal(null) }}
        title={editingSignal ? 'Editar Sinal de Mão' : 'Adicionar Sinal de Mão'}
      >
        <form
          onSubmit={signalForm.handleSubmit((d) =>
            editingSignal
              ? updateSignalMutation.mutate({ id: editingSignal.id, data: d })
              : addSignalMutation.mutate(d)
          )}
          className="space-y-4"
        >
          <Input
            label="Nome do sinal *"
            placeholder="Ex: Parar, Virar à esquerda, Combustível..."
            error={signalForm.formState.errors.name?.message}
            {...signalForm.register('name')}
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              rows={3}
              placeholder="Como executar o sinal, o que significa..."
              {...signalForm.register('description')}
            />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={() => setSignalModal(false)}>Cancelar</Button>
            <Button type="submit" loading={addSignalMutation.isPending || updateSignalMutation.isPending}>
              {editingSignal ? 'Guardar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Contact modal */}
      <Modal open={contactModal} onClose={() => setContactModal(false)} title="Adicionar Contacto de Emergência">
        <form onSubmit={contactForm.handleSubmit((d) => addContactMutation.mutate(d))} className="space-y-4">
          <Input label="Região" placeholder="Luanda, Benguela..." error={contactForm.formState.errors.region?.message} {...contactForm.register('region')} />
          <Input label="Nome" placeholder="Hospital de Santa Maria" error={contactForm.formState.errors.name?.message} {...contactForm.register('name')} />
          <Input label="Função" placeholder="Hospital, Bombeiros, Polícia Nacional..." error={contactForm.formState.errors.role?.message} {...contactForm.register('role')} />
          <Input label="Telefone" placeholder="222 000 000" error={contactForm.formState.errors.phone?.message} {...contactForm.register('phone')} />
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setContactModal(false)}>Cancelar</Button>
            <Button type="submit" loading={addContactMutation.isPending}>Adicionar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
