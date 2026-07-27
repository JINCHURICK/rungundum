import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { ArrowLeft, Trophy, Medal } from 'lucide-react'

interface Entry {
  position: number
  clubId: string
  clubName: string
  clubAcronym: string
  clubLogoUrl: string | null
  clubAccentColor: string
  points: number
  raidsCompleted: number
  totalKm: number
  isMyClub: boolean
}

export default function LeagueDetail() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['league', id],
    queryFn: () => api.get(`/leagues/${id}`).then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (!data) return null

  const entries: Entry[] = data.entries ?? []
  const myEntry = entries.find((e) => e.isMyClub)
  const leagueFinished = data.status === 'FINISHED'

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/leagues" className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{data.name}</h1>
          <p className="text-xs text-gray-500">
            {data.year} {data.region && `· ${data.region}`} · {data.pointsPerRaid} pts/raid
            {leagueFinished && <span className="ml-2 text-gray-400 font-medium">Terminada</span>}
          </p>
        </div>
      </div>

      {/* My position */}
      {myEntry && (
        <Card style={{ borderColor: 'var(--accent)', borderWidth: 2 }}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}>
                {myEntry.position}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">O meu clube — {myEntry.clubName}</p>
                <p className="text-xs text-gray-500">{myEntry.raidsCompleted} raids · {myEntry.totalKm.toFixed(0)} km</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{myEntry.points}</p>
                <p className="text-xs text-gray-400">pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standings */}
      <Card>
        <CardContent className="pt-4">
          {entries.length === 0 ? (
            <div className="text-center py-12">
              <Trophy size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum clube inscrito ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <div
                  key={entry.clubId}
                  className={`py-3 flex items-center gap-3 ${entry.isMyClub ? 'rounded-xl' : ''}`}
                  style={entry.isMyClub ? { backgroundColor: `${entry.clubAccentColor}08` } : {}}
                >
                  {/* Position */}
                  <div className="w-8 text-center flex-shrink-0">
                    {entry.position <= 3 ? (
                      <Medal size={18} className={
                        entry.position === 1 ? 'text-amber-400 mx-auto' :
                        entry.position === 2 ? 'text-gray-400 mx-auto' :
                        'text-amber-600 mx-auto'
                      } />
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{entry.position}</span>
                    )}
                  </div>

                  {/* Club logo */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: entry.clubAccentColor }}
                  >
                    {entry.clubLogoUrl
                      ? <img src={entry.clubLogoUrl} alt={entry.clubAcronym} className="w-full h-full object-cover rounded-xl" />
                      : entry.clubAcronym.substring(0, 3)
                    }
                  </div>

                  {/* Club info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${entry.isMyClub ? 'font-semibold' : 'text-gray-900'}`}>
                      {entry.clubName}
                      {entry.isMyClub && <span className="text-xs ml-1.5 font-normal text-gray-400">(meu clube)</span>}
                    </p>
                    <p className="text-xs text-gray-500">{entry.raidsCompleted} raids · {entry.totalKm.toFixed(0)} km</p>
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-gray-900">{entry.points}</p>
                    <p className="text-xs text-gray-400">pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Pontos atribuídos automaticamente quando um raid é marcado como Concluído.
      </p>
    </div>
  )
}
