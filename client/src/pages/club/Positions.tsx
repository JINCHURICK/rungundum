import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Crown, History, Plus, X } from 'lucide-react'

const STANDARD_TITLES = [
  'Presidente', 'Vice-Presidente', 'Secretário', 'Tesoureiro',
  'Capitão de Estrada', 'Sub-Capitão', 'Provedor', 'Assessor',
  'Relações Públicas', 'Outro',
]

interface SimpleMember {
  id: string; fullName: string; nickname: string | null; memberNumber: string | null; photoUrl: string | null
}

interface Position {
  id: string
  memberId: string
  title: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  notes: string | null
  member: SimpleMember
}

function fmt(d: string) { return new Date(d).toLocaleDateString('pt-AO') }

function Avatar({ m }: { m: SimpleMember }) {
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
      {m.photoUrl
        ? <img src={m.photoUrl} alt={m.fullName} className="w-full h-full object-cover" />
        : <span className="w-full h-full flex items-center justify-center text-gray-500 text-sm font-semibold">{m.fullName[0]}</span>}
    </div>
  )
}

const emptyForm = { memberId: '', title: '', startDate: new Date().toISOString().slice(0, 10), notes: '' }

export default function Positions() {
  const qc = useQueryClient()
  const [tab, setTab]         = useState<'current' | 'history'>('current')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(emptyForm)

  const { data: positions = [], isLoading } = useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: () => api.get('/positions').then(r => r.data),
  })

  const { data: membersData } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  })
  const members: SimpleMember[] = (Array.isArray(membersData) ? membersData : []).filter((m: any) => m.status === 'ACTIVE')

  const createMutation = useMutation({
    mutationFn: () => api.post('/positions', form).then(r => r.data),
    onSuccess: () => {
      toast.success('Cargo atribuído')
      qc.invalidateQueries({ queryKey: ['positions'] })
      setShowModal(false)
      setForm(emptyForm)
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro'),
  })

  function endMandate(id: string) {
    const endDate = new Date().toISOString().slice(0, 10)
    api.patch(`/positions/${id}`, { endDate, isCurrent: false })
      .then(() => { qc.invalidateQueries({ queryKey: ['positions'] }); toast.success('Mandato encerrado') })
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  function deletePos(id: string) {
    if (!confirm('Eliminar este cargo?')) return
    api.delete(`/positions/${id}`)
      .then(() => qc.invalidateQueries({ queryKey: ['positions'] }))
      .catch((e: any) => toast.error(e.response?.data?.error ?? 'Erro'))
  }

  const current = positions.filter(p => p.isCurrent)
  const history = positions.filter(p => !p.isCurrent)

  const displayed = tab === 'current' ? current : history

  // Agrupar cargos actuais por título (ordem padrão)
  const byTitle = STANDARD_TITLES.reduce<Record<string, Position>>((acc, t) => {
    const pos = current.find(p => p.title === t)
    if (pos) acc[t] = pos
    return acc
  }, {})
  const otherCurrent = current.filter(p => !STANDARD_TITLES.slice(0, -1).includes(p.title))

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Órgãos e Cargos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Directoria e mandatos do clube</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Atribuir cargo</Button>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        <button onClick={() => setTab('current')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'current' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <Crown size={14} /> Directoria actual
        </button>
        <button onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'history' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
          <History size={14} /> Histórico
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : tab === 'current' ? (
        <div className="space-y-3">
          {/* Grid de cargos standard */}
          {Object.entries(byTitle).length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(byTitle).map(([title, pos]) => (
                <Card key={title}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar m={pos.member} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {pos.member.nickname ?? pos.member.fullName}
                          {pos.member.memberNumber && <span className="text-gray-400 text-xs ml-1">#{pos.member.memberNumber}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">Desde {fmt(pos.startDate)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3 justify-end">
                      <button onClick={() => endMandate(pos.id)} className="text-xs text-gray-400 hover:text-orange-500 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50">
                        Encerrar mandato
                      </button>
                      <button onClick={() => deletePos(pos.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {/* Outros cargos actuais */}
          {otherCurrent.length > 0 && (
            <Card>
              <CardContent className="pt-0 pb-0">
                <div className="divide-y divide-gray-50">
                  {otherCurrent.map(pos => (
                    <div key={pos.id} className="py-3.5 flex items-center gap-3">
                      <Avatar m={pos.member} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-400">{pos.title}</p>
                        <p className="text-sm font-medium text-gray-900">{pos.member.nickname ?? pos.member.fullName}</p>
                        <p className="text-xs text-gray-400">Desde {fmt(pos.startDate)}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => endMandate(pos.id)} className="text-xs text-gray-400 hover:text-orange-500 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50">Encerrar</button>
                        <button onClick={() => deletePos(pos.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {current.length === 0 && (
            <div className="text-center py-14 text-gray-400">
              <Crown size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum cargo atribuído ainda.</p>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-0 pb-0">
            <div className="divide-y divide-gray-50">
              {displayed.map(pos => (
                <div key={pos.id} className="py-3.5 flex items-center gap-3">
                  <Avatar m={pos.member} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-400">{pos.title}</p>
                    <p className="text-sm font-medium text-gray-900">{pos.member.nickname ?? pos.member.fullName}</p>
                    <p className="text-xs text-gray-400">
                      {fmt(pos.startDate)} → {pos.endDate ? fmt(pos.endDate) : 'presente'}
                    </p>
                  </div>
                  <button onClick={() => deletePos(pos.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"><X size={13} /></button>
                </div>
              ))}
              {displayed.length === 0 && <p className="text-center text-gray-400 text-sm py-10">Sem histórico de cargos.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: atribuir cargo */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Atribuir cargo">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Membro</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
              <option value="">Seleccionar membro...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.nickname ?? m.fullName}{m.memberNumber ? ` #${m.memberNumber}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Cargo</label>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}>
              <option value="">Seleccionar cargo...</option>
              {STANDARD_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Data de início</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
              value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Notas (opcional)</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Mandato, observações..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!form.memberId || !form.title || !form.startDate}
            >
              Atribuir cargo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
