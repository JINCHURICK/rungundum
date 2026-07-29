import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface Props {
  open: boolean
  onContinue: () => void
  onLogout: () => void
}

const COUNTDOWN = 60

export function IdleWarningModal({ open, onContinue, onLogout }: Props) {
  const [secs, setSecs] = useState(COUNTDOWN)

  useEffect(() => {
    if (!open) { setSecs(COUNTDOWN); return }
    const id = setInterval(() => setSecs(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [open])

  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  return (
    <Modal open={open} onClose={onContinue} size="sm">
      <div className="flex flex-col items-center text-center gap-5 py-2">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center">
          <Clock className="w-7 h-7 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-base mb-1">Sessão inativa</h3>
          <p className="text-sm text-gray-500">A sessão vai expirar por inatividade em</p>
          <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">{mm}:{ss}</p>
        </div>
        <div className="flex gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1" onClick={onLogout}>
            Terminar sessão
          </Button>
          <Button size="sm" className="flex-1" onClick={onContinue}>
            Continuar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
