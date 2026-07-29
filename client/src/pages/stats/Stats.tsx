import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Users, Route, Trophy, TrendingUp, Calendar, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function Stats() {
  const currentYear = new Date().getFullYear()
  const [reportYear, setReportYear] = useState(currentYear)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('/stats').then((r) => r.data),
  })

  const reportMutation = useMutation({
    mutationFn: (year: number) => api.post('/pdf/annual-report', { year }, { responseType: 'blob' }),
    onSuccess: (r, year) => {
      const disposition = r.headers['content-disposition'] as string | undefined
      const utf8 = disposition?.match(/filename\*=UTF-8''([^;]+)/i)
      const filename = utf8 ? decodeURIComponent(utf8[1].trim()) : `Relatorio Anual ${year}.pdf`
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('Relatório gerado!')
    },
    onError: () => toast.error('Erro ao gerar relatório'),
  })

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  )

  const maxMonth = Math.max(...(stats?.raidsByMonth?.map((m: any) => m.count) ?? [1]), 1)

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-gray-900">Estatísticas</h1>
        <div className="flex items-center gap-2">
          <select
            value={reportYear}
            onChange={(e) => setReportYear(Number(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            loading={reportMutation.isPending}
            onClick={() => reportMutation.mutate(reportYear)}
          >
            <FileText size={14} />
            Relatório Anual PDF
          </Button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Raids Realizados', value: stats?.completedRaids ?? 0, icon: Trophy, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'KM Percorridos', value: stats?.totalKm ? `${stats.totalKm.toLocaleString('pt-AO')} km` : '0 km', icon: Route, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Membros Activos', value: stats?.activeMembers ?? 0, icon: Users, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Raids Agendados', value: stats?.upcomingRaids ?? 0, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-gray-500" />
              <h2 className="font-semibold text-sm">Actividade (últimos 12 meses)</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.raidsByMonth?.map((m: any) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0 text-right">{m.month}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(m.count / maxMonth) * 100}%`,
                        backgroundColor: m.count > 0 ? 'var(--accent)' : 'transparent',
                        minWidth: m.count > 0 ? '8px' : '0',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-4 flex-shrink-0">
                    {m.count > 0 ? m.count : ''}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top participants */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-gray-500" />
              <h2 className="font-semibold text-sm">Pilotos mais activos</h2>
            </div>
          </CardHeader>
          <CardContent>
            {!stats?.topParticipants?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">Sem dados suficientes.</p>
            ) : (
              <div className="space-y-3">
                {stats.topParticipants.map((p: any, idx: number) => {
                  const maxCount = stats.topParticipants[0]?.count ?? 1
                  const medals = ['🥇', '🥈', '🥉']
                  return (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-base w-6 flex-shrink-0 text-center">
                        {medals[idx] ?? <span className="text-xs text-gray-400 font-bold">{idx + 1}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium truncate">{p.name}</span>
                          <span className="text-xs font-semibold text-gray-600 flex-shrink-0 ml-2">
                            {p.count} raid{p.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(p.count / maxCount) * 100}%`,
                              backgroundColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#9ca3af' : idx === 2 ? '#cd7f32' : 'var(--accent)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary row */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 justify-around text-center">
            {[
              { label: 'Total de Raids', value: stats?.totalRaids ?? 0 },
              { label: 'Realizados', value: stats?.completedRaids ?? 0 },
              { label: 'Agendados', value: stats?.upcomingRaids ?? 0 },
              { label: 'Total de Membros', value: stats?.totalMembers ?? 0 },
              { label: 'Membros Activos', value: stats?.activeMembers ?? 0 },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
