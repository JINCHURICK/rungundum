import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MessageSquare, Send, Users, User, CheckSquare, Square } from 'lucide-react'

interface Member {
  id: string
  fullName: string
  nickname: string | null
  memberNumber: string | null
  phone: string | null
  photoUrl: string | null
  status: string
}

const MAX_CHARS = 160

export default function Sms() {
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'all' | 'select'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  })

  const members: Member[] = (Array.isArray(data) ? data : []).filter((m: Member) => m.status === 'ACTIVE')
  const withPhone = members.filter(m => m.phone)
  const withoutPhone = members.filter(m => !m.phone)

  function toggleMember(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === withPhone.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(withPhone.map(m => m.id)))
    }
  }

  const sendMutation = useMutation({
    mutationFn: () => {
      const payload: any = { message }
      if (mode === 'select') payload.memberIds = Array.from(selected)
      return api.post('/sms/send', payload).then(r => r.data)
    },
    onSuccess: (data) => {
      toast.success(data.message)
      setMessage('')
      setSelected(new Set())
    },
    onError: (e: any) => toast.error(e.response?.data?.error ?? 'Erro ao enviar SMS'),
  })

  const targetCount = mode === 'all' ? withPhone.length : Array.from(selected).filter(id => withPhone.find(m => m.id === id)).length

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">SMS</h1>
        <p className="text-sm text-gray-500 mt-0.5">Enviar mensagens de texto para membros</p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Users size={17} className="text-green-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{withPhone.length}</p>
              <p className="text-xs text-gray-500">Com telemóvel</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <User size={17} className="text-gray-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{withoutPhone.length}</p>
              <p className="text-xs text-gray-500">Sem telemóvel</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compor mensagem */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={16} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Compor mensagem</h2>
          </div>

          <div>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors"
              rows={4}
              maxLength={MAX_CHARS}
              placeholder="Escreve a mensagem aqui..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">Máx. 160 caracteres por SMS</span>
              <span className={`text-xs font-medium ${message.length > 140 ? 'text-amber-600' : 'text-gray-400'}`}>
                {message.length}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Destinatários */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Destinatários</p>
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
              <button
                onClick={() => setMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Todos ({withPhone.length})
              </button>
              <button
                onClick={() => setMode('select')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'select' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Seleccionar
              </button>
            </div>
          </div>

          {/* Botão enviar */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-gray-500">
              {targetCount > 0
                ? <><strong className="text-gray-900">{targetCount}</strong> membro{targetCount !== 1 ? 's' : ''} vão receber este SMS</>
                : <span className="text-amber-600">Nenhum destinatário seleccionado</span>
              }
            </p>
            <Button
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={!message.trim() || targetCount === 0}
            >
              <Send size={15} /> Enviar SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de membros (modo seleccionar) */}
      {mode === 'select' && (
        <Card>
          <CardContent className="pt-3 pb-0">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <p className="text-sm font-medium text-gray-700">Membros com telemóvel</p>
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors">
                {selected.size === withPhone.length ? <CheckSquare size={14} /> : <Square size={14} />}
                {selected.size === withPhone.length ? 'Desseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {withPhone.map(m => (
                <div
                  key={m.id}
                  className="py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors"
                  onClick={() => toggleMember(m.id)}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${selected.has(m.id) ? 'text-red-600' : 'text-gray-300'}`}>
                    {selected.has(m.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                    {m.photoUrl
                      ? <img src={m.photoUrl} alt={m.fullName} className="w-full h-full object-cover" />
                      : <span className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-semibold">{m.fullName[0]}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {m.nickname ?? m.fullName}
                      {m.memberNumber && <span className="text-gray-400 text-xs ml-1">#{m.memberNumber}</span>}
                    </p>
                    <p className="text-xs text-gray-400">{m.phone}</p>
                  </div>
                </div>
              ))}
              {withPhone.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Nenhum membro tem telemóvel configurado.</p>
              )}
            </div>

            {withoutPhone.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50 pb-3">
                <p className="text-xs text-gray-400">
                  {withoutPhone.length} membro{withoutPhone.length !== 1 ? 's' : ''} sem telemóvel não aparece{withoutPhone.length !== 1 ? 'm' : ''} aqui.
                  Adiciona o número em <strong>Membros</strong>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
