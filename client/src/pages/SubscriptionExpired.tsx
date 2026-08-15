import { useNavigate } from 'react-router-dom'
import { AlertTriangle, LogOut, Mail, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

export default function SubscriptionExpired() {
  const { user, club, logout, refreshToken } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    try { await api.post('/auth/logout', { refreshToken }) } catch {}
    logout()
    navigate('/login')
    toast.success('Sessão terminada')
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'APP_ADMIN'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-amber-500" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">Subscrição expirada</h1>

        {club?.name && (
          <p className="text-sm text-gray-500 mb-1">
            O acesso do clube <span className="font-semibold text-gray-700">{club.name}</span> está suspenso.
          </p>
        )}

        <p className="text-sm text-gray-500 mb-6">
          {isAdmin
            ? 'Renova a subscrição para recuperar o acesso completo ao sistema.'
            : 'Contacta o administrador do clube para renovar a subscrição.'}
        </p>

        <div className="space-y-3">
          {isAdmin && (
            <button
              onClick={() => navigate('/subscription/pay')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
            >
              <RefreshCw size={15} />
              Renovar subscrição
            </button>
          )}

          <a
            href="mailto:suporte@rungundum.com"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Mail size={15} />
            Contactar suporte
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut size={15} />
            Terminar sessão
          </button>
        </div>
      </div>
    </div>
  )
}
