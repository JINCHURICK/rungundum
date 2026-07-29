import { useState, useEffect } from 'react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

const isSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? Notification.permission : 'denied'
  )
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Verificar se já existe subscrição activa ao montar
  useEffect(() => {
    if (!isSupported) return
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => setIsSubscribed(!!sub))
    })
    setPermission(Notification.permission)
  }, [])

  async function subscribe() {
    if (!isSupported) return
    setIsLoading(true)
    try {
      const { data } = await api.get('/notifications/vapid-key')
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      })

      const json = sub.toJSON()
      await api.post('/notifications/push-subscribe', {
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('[Push] subscribe error', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function unsubscribe() {
    if (!isSupported) return
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.delete('/notifications/push-subscribe', { data: { endpoint: sub.endpoint } })
        await sub.unsubscribe()
      }
      setIsSubscribed(false)
    } catch (err) {
      console.error('[Push] unsubscribe error', err)
    } finally {
      setIsLoading(false)
    }
  }

  return { permission, isSubscribed, isLoading, isSupported, subscribe, unsubscribe }
}
