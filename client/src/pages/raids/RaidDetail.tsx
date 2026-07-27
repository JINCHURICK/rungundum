import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, Pencil, Copy, CheckCircle, XCircle, Play,
  MapPin, Clock, Users, Route, AlertTriangle, Share2, MoreVertical,
  Camera, Trash2, ImagePlus
} from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { RaidStatusBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDate, getDifficultyLabel } from '@/lib/utils'
import ChecklistSection from './ChecklistSection'
import TeamSection from './TeamSection'

const ROUTE_TYPE_LABELS: Record<string, string> = {
  DEPARTURE: '🚀 Saída',
  ARRIVAL: '🏁 Chegada',
  STOP: '📍 Paragem',
  TECH_STOP: '🔧 Pausa Técnica',
  BREAKFAST: '🥐 Pequeno Almoço',
  LUNCH: '🍽️ Almoço',
  COFFEE: '☕ Café',
  FUEL: '⛽ Abastecimento',
  OVERNIGHT: '🏨 Pernoita',
  SCENIC: '📸 Ponto Panorâmico',
  BORDER: '🛂 Fronteira',
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; icon: any }> = {
  DRAFT: { label: 'Publicar', next: 'CONFIRMED', icon: CheckCircle },
  CONFIRMED: { label: 'Iniciar', next: 'IN_PROGRESS', icon: Play },
  IN_PROGRESS: { label: 'Concluir', next: 'COMPLETED', icon: CheckCircle },
}

function extractFilename(disposition: string | undefined, fallback: string): string {
  if (!disposition) return fallback
  // RFC 5987 — filename*=UTF-8''...
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) return decodeURIComponent(utf8Match[1].trim())
  // fallback — filename="..."
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
  if (asciiMatch) return asciiMatch[1].trim()
  return fallback
}

const PDF_SECTIONS = [
  { key: 'includeRoutePoints', label: 'Roteiro detalhado' },
  { key: 'includeRoster', label: 'Lista de participantes' },
  { key: 'includeContingency', label: 'Plano de contingência' },
  { key: 'includeEmergencyContacts', label: 'Contactos de emergência' },
  { key: 'includeBriefing', label: 'Guião de briefing' },
  { key: 'includeChecklist', label: 'Checklist do piloto' },
  { key: 'includeSignatures', label: 'Espaço para assinaturas' },
  { key: 'includeStatutes', label: 'Estatuto do clube' },
]

export default function RaidDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [pdfModal, setPdfModal] = useState(false)
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [pdfOptions, setPdfOptions] = useState<Record<string, boolean>>({
    includeRoutePoints: true,
    includeRoster: true,
    includeContingency: true,
    includeEmergencyContacts: true,
    includeBriefing: true,
    includeChecklist: false,
    includeSignatures: false,
    includeStatutes: false,
  })

  const { data: raid, isLoading } = useQuery({
    queryKey: ['raid', id],
    queryFn: () => api.get(`/raids/${id}`).then((r) => r.data),
  })

  const isAdmin = ['ADMIN', 'CAPTAIN'].includes(user?.role ?? '')

  const statusMutation = useMutation({
    mutationFn: ({ status, cancelReason }: { status: string; cancelReason?: string }) =>
      api.patch(`/raids/${id}/status`, { status, cancelReason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', id] }); toast.success('Estado actualizado!') },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro'),
  })

  const duplicateMutation = useMutation({
    mutationFn: () => api.post(`/raids/${id}/duplicate`).then((r) => r.data),
    onSuccess: (newRaid) => { toast.success('Raid duplicado!'); navigate(`/raids/${newRaid.id}`) },
    onError: () => toast.error('Erro ao duplicar raid'),
  })

  const imageMutation = useMutation({
    mutationFn: () => api.post(`/pdf/raids/${id}/program-pdf`, {}, { responseType: 'blob' }),
    onSuccess: (r) => {
      const filename = extractFilename(r.headers['content-disposition'], 'Resumo.pdf')
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF Resumo gerado!')
    },
    onError: () => toast.error('Erro ao gerar PDF Resumo'),
  })

  const pdfMutation = useMutation({
    mutationFn: (options: Record<string, boolean>) =>
      api.post(`/pdf/raids/${id}`, options, { responseType: 'blob' }),
    onSuccess: (r) => {
      const filename = extractFilename(r.headers['content-disposition'], 'Plano de Raid.pdf')
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
      setPdfModal(false)
      toast.success('PDF gerado com sucesso!')
    },
    onError: () => toast.error('Erro ao gerar PDF'),
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('photo', file)
      return api.post(`/raids/${id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', id] }); toast.success('Foto adicionada!') },
    onError: () => toast.error('Erro ao fazer upload da foto'),
  })

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.delete(`/raids/${id}/photos/${photoId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['raid', id] }); toast.success('Foto eliminada') },
    onError: () => toast.error('Erro ao eliminar foto'),
  })

  function handleCancel() {
    statusMutation.mutate({ status: 'CANCELLED', cancelReason })
    setCancelModal(false)
  }

  function copyPublicLink() {
    const url = `${window.location.origin}/public/${raid?.publicToken}`
    navigator.clipboard.writeText(url)
    toast.success('Link copiado!')
  }

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
    </div>
  )
  if (!raid) return <div className="text-center py-16 text-gray-500">Raid não encontrado</div>

  const transition = STATUS_TRANSITIONS[raid.status]
  const confirmedCount = raid.participants?.filter((p: any) => p.status === 'CONFIRMED').length ?? 0
  const totalCount = raid.participants?.length ?? 0


  return (
    <div className="fade-in space-y-4">
      {/* Header — compact on mobile */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link to="/raids" className="p-1.5 -ml-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <RaidStatusBadge status={raid.status} />
        </div>
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{raid.title}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{raid.origin} → {raid.destination} · {formatDate(raid.date)}</p>
      </div>

      {/* Action buttons — primary action prominent, rest in overflow */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          {/* Primary status transition */}
          {transition && (
            <Button
              size="sm"
              onClick={() => statusMutation.mutate({ status: transition.next })}
              loading={statusMutation.isPending}
              className="flex-1 sm:flex-none"
            >
              <transition.icon size={15} />
              {transition.label}
            </Button>
          )}

          {/* PDF export */}
          <Button variant="secondary" size="sm" onClick={() => setPdfModal(true)}>
            <Download size={15} />
            <span className="hidden sm:inline">PDF</span>
          </Button>

          {/* PDF Resumo */}
          <Button variant="secondary" size="sm" loading={imageMutation.isPending} onClick={() => imageMutation.mutate()}>
            <Download size={15} />
            <span className="hidden sm:inline">PDF Resumo</span>
          </Button>

          {/* More actions dropdown */}
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setMoreOpen(!moreOpen)}>
              <MoreVertical size={15} />
            </Button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[160px]">
                  {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(raid.status) && (
                    <button onClick={() => { copyPublicLink(); setMoreOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Share2 size={14} /> Partilhar link
                    </button>
                  )}
                  {['DRAFT', 'CONFIRMED'].includes(raid.status) && (
                    <Link to={`/raids/${id}/edit`} onClick={() => setMoreOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Pencil size={14} /> Editar
                    </Link>
                  )}
                  <button onClick={() => { duplicateMutation.mutate(); setMoreOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Copy size={14} /> Duplicar
                  </button>
                  {raid.status === 'CONFIRMED' && (
                    <button onClick={() => { setCancelModal(true); setMoreOpen(false) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                      <XCircle size={14} /> Cancelar raid
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Metrics — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Distância', value: raid.estimatedKm ? `${raid.estimatedKm} km` : '—', icon: Route },
          { label: 'Duração', value: raid.estimatedDuration ?? '—', icon: Clock },
          { label: 'Participantes', value: `${confirmedCount}/${totalCount}`, icon: Users },
          { label: 'Dificuldade', value: getDifficultyLabel(raid.difficulty), icon: MapPin },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-2.5 py-3.5 px-3">
              <div className="p-2 rounded-lg bg-gray-50 flex-shrink-0"><Icon size={16} className="text-gray-500" /></div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Route */}
          {raid.routePoints?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-sm">Roteiro</h3></CardHeader>
              <CardContent className="p-0">
                {/* Mobile: stacked card list */}
                <div className="sm:hidden divide-y divide-gray-50">
                  {raid.routePoints.map((rp: any, idx: number) => (
                    <div key={rp.id} className="px-4 py-3 flex items-start gap-3">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 flex-shrink-0 font-semibold">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{rp.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{ROUTE_TYPE_LABELS[rp.type] ?? rp.type}</span>
                          {rp.scheduledDate && <span className="text-xs text-gray-400">{rp.scheduledDate}</span>}
                          {rp.scheduledTime && <span className="text-xs text-gray-400">{rp.scheduledTime}</span>}
                          {rp.kmAccumulated != null && <span className="text-xs text-gray-400">{rp.kmAccumulated} km</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase border-b">
                        <th className="pb-2 pt-1 px-4 text-left">#</th>
                        <th className="pb-2 pt-1 text-left">Local</th>
                        <th className="pb-2 pt-1 text-left">Tipo</th>
                        <th className="pb-2 pt-1 text-left">Data / Hora</th>
                        <th className="pb-2 pt-1 text-left pr-4">KM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {raid.routePoints.map((rp: any, idx: number) => (
                        <tr key={rp.id}>
                          <td className="py-2.5 px-4 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="py-2.5 font-medium text-sm whitespace-nowrap">{rp.name}</td>
                          <td className="py-2.5"><span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 whitespace-nowrap">{ROUTE_TYPE_LABELS[rp.type] ?? rp.type}</span></td>
                          <td className="py-2.5 text-gray-500 text-xs whitespace-nowrap">
                            {rp.scheduledDate && <span className="mr-1">{rp.scheduledDate}</span>}
                            {rp.scheduledTime ?? (!rp.scheduledDate ? '—' : '')}
                          </td>
                          <td className="py-2.5 text-gray-500 text-xs whitespace-nowrap pr-4">{rp.kmAccumulated != null ? `${rp.kmAccumulated} km` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist */}
          <ChecklistSection raidId={id!} participants={raid.participants ?? []} />

          {/* Photo gallery */}
          {(raid.photos?.length > 0 || isAdmin) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera size={15} className="text-gray-500" />
                    <h3 className="font-semibold text-sm">Galeria de Fotos</h3>
                    {raid.photos?.length > 0 && <span className="text-xs text-gray-400">({raid.photos.length})</span>}
                  </div>
                  {isAdmin && (
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadPhotoMutation.isPending}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhotoMutation.mutate(f); e.target.value = '' }}
                      />
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600">
                        <ImagePlus size={13} />
                        {uploadPhotoMutation.isPending ? 'A carregar...' : 'Adicionar foto'}
                      </span>
                    </label>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {raid.photos?.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Ainda não há fotos. Adiciona as fotos do raid!</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {raid.photos.map((photo: any) => (
                      <div key={photo.id} className="relative group aspect-square">
                        <img
                          src={photo.url}
                          alt={photo.caption ?? ''}
                          className="w-full h-full object-cover rounded-xl cursor-pointer"
                          onClick={() => setLightboxUrl(photo.url)}
                        />
                        {isAdmin && (
                          <button
                            onClick={() => deletePhotoMutation.mutate(photo.id)}
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                        {photo.caption && (
                          <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-2 py-1 rounded-b-xl truncate">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contingency */}
          {raid.contingencyPlan && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-orange-500" />
                  <h3 className="font-semibold text-sm">Plano de Contingência</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: '🚨 Acidente / Queda', text: raid.contingencyPlan.accidentText },
                  { label: '🔧 Avaria de Moto', text: raid.contingencyPlan.breakdownText },
                  { label: '📡 Separação de Piloto', text: raid.contingencyPlan.separationText },
                  { label: '⛈️ Condições Meteorológicas', text: raid.contingencyPlan.weatherText },
                ].map(({ label, text }) => text ? (
                  <div key={label} className="border-l-4 border-orange-200 pl-3 py-1">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">{label}</p>
                    <p className="text-sm text-gray-600">{text}</p>
                  </div>
                ) : null)}
                {raid.contingencyPlan.rallyPoint && (
                  <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t">
                    <MapPin size={13} className="text-green-500 flex-shrink-0" />
                    <span className="font-medium">Ponto de reagrupamento:</span>
                    <span className="text-gray-600">{raid.contingencyPlan.rallyPoint}</span>
                  </div>
                )}
                {Array.isArray(raid.contingencyPlan.contactsJson) && raid.contingencyPlan.contactsJson.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Contactos de Emergência</p>
                    <div className="space-y-1.5">
                      {(raid.contingencyPlan.contactsJson as any[]).map((c: any, i: number) => (
                        <div key={i} className="py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-gray-700 truncate">{c.name}</span>
                            <a href={`tel:${c.phone}`} className="text-blue-600 font-mono text-xs hover:underline flex-shrink-0">{c.phone}</a>
                          </div>
                          {c.role && <span className="text-xs text-gray-400 mt-0.5 block">{c.role}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Team + Info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <TeamSection raidId={id!} participants={raid.participants ?? []} isAdmin={isAdmin} raidStatus={raid.status} myMemberId={user?.memberId ?? undefined} />
            </CardContent>
          </Card>

          {(raid.maxSpeed || raid.communicationChannel || raid.roadTypes?.length > 0 || raid.accommodation) && (
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                {raid.maxSpeed && <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Vel. máx.:</span><span>{raid.maxSpeed} km/h</span></div>}
                {raid.communicationChannel && <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Rádio:</span><span>{raid.communicationChannel}</span></div>}
                {raid.roadTypes?.length > 0 && <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Estrada:</span><span>{raid.roadTypes.join(', ')}</span></div>}
                {raid.accommodation && <div className="flex gap-2"><span className="text-gray-500 w-28 flex-shrink-0">Alojamento:</span><span>{raid.accommodation}</span></div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* PDF Export Modal */}
      <Modal open={pdfModal} onClose={() => setPdfModal(false)} title="Exportar PDF do Raid" size="sm">
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-500">Escolha as secções a incluir no PDF:</p>
          {PDF_SECTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={pdfOptions[key] ?? false}
                onChange={(e) => setPdfOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="w-4 h-4 rounded flex-shrink-0"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
        <Button className="w-full" loading={pdfMutation.isPending} onClick={() => pdfMutation.mutate(pdfOptions)}>
          <Download size={16} />
          Gerar e Descarregar PDF
        </Button>
      </Modal>

      {/* Cancel Modal */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Cancelar Raid" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Tem a certeza que pretende cancelar este raid? Esta acção não pode ser revertida.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo do cancelamento</label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo do cancelamento..."
              className="w-full px-3 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCancelModal(false)}>Voltar</Button>
            <Button variant="danger" className="flex-1" onClick={handleCancel} loading={statusMutation.isPending}>Cancelar Raid</Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}
