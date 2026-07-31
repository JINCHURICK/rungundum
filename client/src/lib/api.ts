import axios from 'axios'
import { useAuthStore } from '@/store/auth'

export const api = axios.create({ baseURL: '/api', withCredentials: true })

api.interceptors.request.use((config) => {
  const { accessToken, user, viewingClub } = useAuthStore.getState()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  // Platform admin a gerir outro clube: enviar X-Club-Id para sobrepor o clubId do JWT
  if (user?.platformAdmin && viewingClub) {
    config.headers['X-Club-Id'] = viewingClub.id
  }
  return config
})

// Deduplicação do refresh: garante que apenas um pedido de refresh está em voo
// ao mesmo tempo, evitando que múltiplos 401 simultâneos desencadeiem vários
// refreshes concorrentes (o que activaria o reuse detection e causaria logout).
let refreshPromise: Promise<string> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 402 && error.response?.data?.code === 'SUBSCRIPTION_EXPIRED') {
      window.location.href = '/subscription-expired'
      return Promise.reject(error)
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const refreshToken = useAuthStore.getState().refreshToken
            if (!refreshToken) throw new Error('No refresh token')
            const { data } = await axios.post('/api/auth/refresh', { refreshToken })
            useAuthStore.getState().setAccessToken(data.accessToken)
            if (data.refreshToken) {
              useAuthStore.setState({ refreshToken: data.refreshToken })
            }
            return data.accessToken as string
          })().finally(() => { refreshPromise = null })
        }
        const newAccessToken = await refreshPromise
        original.headers.Authorization = `Bearer ${newAccessToken}`
        return api(original)
      } catch (refreshErr: any) {
        const code = refreshErr?.response?.data?.code
        if (code === 'SESSION_TERMINATED') {
          sessionStorage.setItem('logout-reason', 'A sua sessão foi terminada por um novo início de sessão noutro dispositivo.')
        } else if (code === 'IDLE_TIMEOUT') {
          sessionStorage.setItem('logout-reason', 'A sessão expirou por inatividade.')
        }
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
