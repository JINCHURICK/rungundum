import { useEffect, useRef, useCallback } from 'react'

const IDLE_MS = 10 * 60 * 1000   // 10 minutos sem actividade → logout
const WARN_MS = IDLE_MS - 60_000  // aviso 1 minuto antes

export function useIdleTimer({
  onWarn,
  onIdle,
  enabled,
}: {
  onWarn: () => void
  onIdle: () => void
  enabled: boolean
}) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    warnTimer.current = setTimeout(onWarn, WARN_MS)
    idleTimer.current = setTimeout(onIdle, IDLE_MS)
  }, [onWarn, onIdle])

  useEffect(() => {
    if (!enabled) {
      if (warnTimer.current) clearTimeout(warnTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
      return
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => document.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach(e => document.removeEventListener(e, reset))
      if (warnTimer.current) clearTimeout(warnTimer.current)
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [enabled, reset])
}
