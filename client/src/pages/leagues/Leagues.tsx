import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Trophy, Plus, Users, ChevronRight, MapPin } from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

interface League {
  id: string
  name: string
  year: number
  region: string | null
  description: string | null
  status: 'ACTIVE' | 'FINISHED'
  pointsPerRaid: number
  bonusKmPoints: number
  clubCount: number
  myEntry: { points: number; raidsCompleted: number; totalKm: number } | null
}

export default function Leagues() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', year: String(CURRENT_YEAR), region: '', description: '', pointsPerRaid: '100', bonusKmPoints: '0.1' })

  const { data: leagues = [], isLoading } = useQuery<League[]>({
    queryKey: ['leagues'],
    queryFn: () => api.get('/leagues').then((r) => r.data),
  })

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leagues/${id}/join`).then((r) => r.data),
    onSuccess: () => { toast.success('Inscrito na liga!'); queryClient.invalidateQueries({ queryKey: ['leagues'] }) },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao inscrever'),
  })

  const leaveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/leagues/${id}/leave`).then((r) => r.data),
    onSuccess: () => { toast.success('Saiu da liga.'); queryClient.invalidateQueries({ queryKey: ['leagues'] }) },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/leagues', {
      name: form.name,
      year: parseInt(form.year),
      region: form.region || undefined,
      description: form.description || undefined,
      pointsPerRaid: parseInt(form.pointsPerRaid),
      bonusKmPoints: parseFloat(form.bonusKmPoints),
    }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Liga criada!')
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      setShowCreate(false)
      setForm({ name: '', year: String(CURRENT_YEAR), region: '', description: '', pointsPerRaid: '100', bonusKmPoints: '0.1' })
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao criar liga'),
  })

  const active = leagues.filter((l) => l.status === 'ACTIVE')
  const finished = leagues.filter((l) => l.status === 'FINISHED')

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ligas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Rankings entre clubes por raids completados</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Nova liga
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
        </div>
      ) : leagues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Ainda não há ligas</p>
            {isAdmin && (
              <p className="text-sm text-gray-400 mt-1">Cria a primeira liga para começar a competição</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Em curso</h2>
              {active.map((l) => <LeagueCard key={l.id} league={l} onJoin={() => joinMutation.mutate(l.id)} onLeave={() => leaveMutation.mutate(l.id)} joining={joinMutation.isPending} leaving={leaveMutation.isPending} />)}
            </section>
          )}
          {finished.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Terminadas</h2>
              {finished.map((l) => <LeagueCard key={l.id} league={l} onJoin={() => {}} onLeave={() => {}} joining={false} leaving={false} />)}
            </section>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova liga">
        <div className="space-y-4">
          <Input label="Nome da liga *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Liga Nacional de Raids 2025" />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input label="Ano" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="flex-1">
              <Input label="Região" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Portugal" />
            </div>
          </div>
          <Input label="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opcional" />
          <div className="flex gap-3">
            <div className="flex-1">
              <Input label="Pontos por raid" type="number" value={form.pointsPerRaid} onChange={(e) => setForm({ ...form, pointsPerRaid: e.target.value })} />
            </div>
            <div className="flex-1">
              <Input label="Bónus/km" type="number" value={form.bonusKmPoints} onChange={(e) => setForm({ ...form, bonusKmPoints: e.target.value })} hint="Ex: 0.1 = 10 pts por 100km" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!form.name}>
              Criar liga
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function LeagueCard({ league, onJoin, onLeave, joining, leaving }: {
  league: League
  onJoin: () => void
  onLeave: () => void
  joining: boolean
  leaving: boolean
}) {
  const isJoined = !!league.myEntry

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
            <Trophy size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{league.name}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${league.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {league.status === 'ACTIVE' ? 'Em curso' : 'Terminada'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>{league.year}</span>
              {league.region && <><MapPin size={11} /> {league.region}</>}
              <><Users size={11} /> {league.clubCount} clubes</>
              <span>{league.pointsPerRaid} pts/raid</span>
            </div>
            {league.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{league.description}</p>}
            {isJoined && league.myEntry && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                  {league.myEntry.points} pts
                </span>
                <span className="text-gray-500">{league.myEntry.raidsCompleted} raids</span>
                <span className="text-gray-500">{league.myEntry.totalKm.toFixed(0)} km</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              to={`/leagues/${league.id}`}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronRight size={18} />
            </Link>
            {league.status === 'ACTIVE' && (
              isJoined
                ? <Button size="sm" variant="secondary" onClick={onLeave} loading={leaving}>Sair</Button>
                : <Button size="sm" onClick={onJoin} loading={joining}>Inscrever</Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
