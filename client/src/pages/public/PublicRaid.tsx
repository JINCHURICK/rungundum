import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import axios from 'axios'
import { MapPin, Clock, Route, Users, Bike } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const ROUTE_TYPE_LABELS: Record<string, string> = {
  DEPARTURE: 'Saída', ARRIVAL: 'Chegada', STOP: 'Paragem',
  TECH_STOP: 'Pausa Técnica', BREAKFAST: 'Pequeno Almoço',
  LUNCH: 'Almoço', COFFEE: 'Café', FUEL: 'Abastecimento',
  OVERNIGHT: 'Pernoita', SCENIC: 'Ponto Panorâmico', BORDER: 'Fronteira',
}

const ROLE_LABELS: Record<string, string> = {
  LEADER: 'Capitão de Estrada', TAIL: 'Cauda', MEMBER: 'Membro',
  MECHANIC: 'Mecânico', SUPPORT: 'Apoio',
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmado', IN_PROGRESS: 'Em Curso', COMPLETED: 'Realizado',
}

export default function PublicRaid() {
  const { token } = useParams<{ token: string }>()

  const { data: raid, isLoading, isError } = useQuery({
    queryKey: ['public-raid', token],
    queryFn: () => axios.get(`/api/public/raids/${token}`).then((r) => r.data),
    retry: false,
  })

  useEffect(() => {
    if (raid?.club?.accentColor) {
      document.documentElement.style.setProperty('--accent', raid.club.accentColor)
    }
  }, [raid?.club?.accentColor])

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full" style={{ borderTopColor: '#dc2626' }} />
    </div>
  )

  if (isError || !raid) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center">
        <p className="text-4xl mb-4">🏍️</p>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Raid não encontrado</h2>
        <p className="text-sm text-gray-500">Este link pode ter expirado ou o raid ainda não está publicado.</p>
      </div>
    </div>
  )

  const accent = raid.club?.accentColor ?? '#dc2626'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-10 px-6" style={{ backgroundColor: accent }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            {raid.club?.logoUrl ? (
              <img src={raid.club.logoUrl} alt={raid.club.name} className="w-10 h-10 rounded-xl object-cover bg-white/20" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Bike size={20} className="text-white" />
              </div>
            )}
            <div>
              <p className="text-white/70 text-xs uppercase tracking-wider">{raid.club?.name}</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold mb-1">{raid.title}</h1>
          <p className="text-white/80 text-sm">{raid.origin} → {raid.destination}</p>

          <div className="flex flex-wrap gap-4 mt-5 text-sm">
            <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
              <Clock size={14} />
              {formatDate(raid.date)}
            </div>
            {raid.estimatedKm && (
              <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
                <Route size={14} />
                {raid.estimatedKm} km
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-white/15 rounded-lg px-3 py-1.5">
              <Users size={14} />
              {raid.participants?.length ?? 0} pilotos
            </div>
            <div className="bg-white/15 rounded-lg px-3 py-1.5 font-semibold">
              {STATUS_LABELS[raid.status] ?? raid.status}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Description */}
        {raid.description && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-sm text-gray-700 leading-relaxed">{raid.description}</p>
          </div>
        )}

        {/* Route */}
        {raid.routePoints?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <MapPin size={15} className="text-gray-500" />
              <h2 className="font-semibold text-sm">Roteiro</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {raid.routePoints.map((rp: any, idx: number) => (
                <div key={rp.id} className="flex items-center gap-3 px-5 py-3">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: accent }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{rp.name}</p>
                    <p className="text-xs text-gray-400">{ROUTE_TYPE_LABELS[rp.type] ?? rp.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {rp.scheduledTime && <p className="text-xs font-medium text-gray-700">{rp.scheduledTime}</p>}
                    {rp.kmAccumulated != null && <p className="text-xs text-gray-400">{rp.kmAccumulated} km</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Participants */}
        {raid.participants?.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Users size={15} className="text-gray-500" />
              <h2 className="font-semibold text-sm">Equipa ({raid.participants.length})</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {raid.participants.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  {p.member.photoUrl ? (
                    <img src={p.member.photoUrl} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-500 flex-shrink-0">
                      {p.member.fullName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.member.nickname ?? p.member.fullName}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABELS[p.role] ?? p.role}</p>
                  </div>
                  {p.vehicle && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Bike size={12} />
                      {p.vehicle.brand} {p.vehicle.model}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Powered by Rungundum · {raid.club?.name}
        </p>
      </div>
    </div>
  )
}
