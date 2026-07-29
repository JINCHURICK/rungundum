import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null

  return (
    <div className="w-full bg-amber-500 text-white text-xs font-medium flex items-center justify-center gap-2 py-2 px-4 z-40">
      <WifiOff size={13} className="flex-shrink-0" />
      Sem ligação à internet — a mostrar dados guardados
    </div>
  )
}
