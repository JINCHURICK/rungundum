import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Megaphone, Pin, Plus, X, Pencil } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

interface Announcement {
  id: string
  title: string
  body: string
  pinned: boolean
  createdById: string
  createdAt: string
  updatedAt: string
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const emptyForm = { title: '', body: '', pinned: false }

export default function Announcements() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(user?.role ?? '')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Announcement | null>(null)
  const [form, setForm]           = useState(emptyForm)

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => api.get('/announcements').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/announcements', form).then(r => r.data),
    onSuccess: () => {
      toast.success('Comunicado publicado')
      qc.invalidateQueries({ queryKey: ['announcements'] })
      closeModal()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/announcements/${editing!.id}`, form).then(r => r.data),
    onSuccess: () => {
      toast.success('Comunicado actualizado')
      qc.invalidateQueries({ queryKey: ['announcements'] })
      closeModal()
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  function openCreate() { setEditing(null); setForm(emptyForm); setShowModal(true) }
  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({ title: a.title, body: a.body, pinned: a.pinned })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditing(null) }

  function togglePin(a: Announcement) {
    api.patch(`/announcements/${a.id}`, { pinned: !a.pinned })
      .then(() => qc.invalidateQueries({ queryKey: ['announcements'] }))
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function deleteAnn(id: string) {
    if (!confirm('Eliminar este comunicado?')) return
    api.delete(`/announcements/${id}`)
      .then(() => { qc.invalidateQueries({ queryKey: ['announcements'] }); toast.success('Eliminado') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  const pinned  = announcements.filter(a => a.pinned)
  const regular = announcements.filter(a => !a.pinned)

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comunicados</h1>
          <p className="text-sm text-gray-500 mt-0.5">Avisos e informações para os membros do clube</p>
        </div>
        {isAdmin && <Button onClick={openCreate}><Plus size={15} /> Novo comunicado</Button>}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Ainda não há comunicados publicados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Fixados */}
          {pinned.map(a => (
            <Card key={a.id} className="border-amber-200 bg-amber-50">
              <CardContent className="pt-4 pb-4">
                <AnnCard a={a} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteAnn} onTogglePin={togglePin} />
              </CardContent>
            </Card>
          ))}
          {/* Normais */}
          {regular.map(a => (
            <Card key={a.id}>
              <CardContent className="pt-4 pb-4">
                <AnnCard a={a} isAdmin={isAdmin} onEdit={openEdit} onDelete={deleteAnn} onTogglePin={togglePin} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Editar comunicado' : 'Novo comunicado'}>
        <div className="space-y-4">
          <Input label="Título" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Raid de Setembro — confirmação de presenças" />
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Mensagem</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
              rows={5}
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Escreve o comunicado aqui..."
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded" checked={form.pinned}
              onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} />
            <span className="text-sm text-gray-700">Fixar no topo</span>
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button
              onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!form.title || !form.body}
            >
              {editing ? 'Guardar' : 'Publicar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function AnnCard({ a, isAdmin, onEdit, onDelete, onTogglePin }: {
  a: Announcement
  isAdmin: boolean
  onEdit: (a: Announcement) => void
  onDelete: (id: string) => void
  onTogglePin: (a: Announcement) => void
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {a.pinned && <Pin size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{fmt(a.createdAt)}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => onTogglePin(a)} className={`p-1.5 transition-colors rounded ${a.pinned ? 'text-amber-500 hover:text-amber-700' : 'text-gray-300 hover:text-amber-500'}`} title={a.pinned ? 'Desafixar' : 'Fixar'}>
              <Pin size={13} />
            </button>
            <button onClick={() => onEdit(a)} className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete(a.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{a.body}</p>
    </div>
  )
}
