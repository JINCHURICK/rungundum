import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type State = 'loading' | 'success' | 'error'

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [state, setState] = useState<State>('loading')
  const [error, setError] = useState('')
  // useRef evita dupla execução do React StrictMode (que dispara effects 2× em dev)
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    if (!token) { setState('error'); setError('Link inválido.'); return }

    axios.post('/api/auth/verify-email', { token })
      .then(({ data }) => {
        setAuth(data)
        setState('success')
        setTimeout(() => navigate('/dashboard'), 2000)
      })
      .catch((err) => {
        setState('error')
        setError(err.response?.data?.error ?? 'Link inválido ou expirado.')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-lg font-bold text-gray-900">A verificar o email...</h2>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Email verificado!</h2>
            <p className="text-gray-500 text-sm">A redirigir para o dashboard...</p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Verificação falhou</h2>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <div className="space-y-2">
              <Link to="/register">
                <Button className="w-full">Criar conta nova</Button>
              </Link>
              <Link to="/login" className="block text-sm text-gray-400 hover:text-gray-600">
                ← Voltar ao login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
