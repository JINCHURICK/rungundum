import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Mail } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})
type FormData = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const logoutReason = (() => {
    const r = sessionStorage.getItem('logout-reason')
    if (r) sessionStorage.removeItem('logout-reason')
    return r
  })()

  // 2FA state
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  // Email não verificado
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  // Passo 1 — credenciais
  const loginMutation = useMutation({
    mutationFn: (data: FormData) => axios.post('/api/auth/login', data).then((r) => r.data),
    onSuccess: (data) => {
      if (data.requires2FA) {
        setPendingToken(data.pendingToken)
        setTimeout(() => codeRefs.current[0]?.focus(), 100)
      }
    },
    onError: (err: any) => {
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setUnverifiedEmail(err.response.data.email)
      } else {
        toast.error(err.response?.data?.error ?? 'Erro ao entrar')
      }
    },
  })

  const resendMutation = useMutation({
    mutationFn: () => axios.post('/api/auth/resend-verification', { email: unverifiedEmail }).then((r) => r.data),
    onSuccess: () => toast.success('Email reenviado! Verifica a caixa de entrada.'),
    onError: () => toast.error('Erro ao reenviar. Tenta mais tarde.'),
  })

  // Passo 2 — código 2FA
  const verifyMutation = useMutation({
    mutationFn: (codeStr: string) =>
      axios.post('/api/auth/verify-2fa', { pendingToken, code: codeStr }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data)
      navigate('/dashboard')
      toast.success(`Bem-vindo, ${data.club.name}!`)
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'Código incorrecto')
      setCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    },
  })

  function handleCodeInput(idx: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...code]
    next[idx] = val.slice(-1)
    setCode(next)
    if (val && idx < 5) codeRefs.current[idx + 1]?.focus()
    if (next.every((c) => c) && !verifyMutation.isPending) {
      verifyMutation.mutate(next.join(''))
    }
  }

  function handleCodeKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length === 6) {
      setCode(paste.split(''))
      verifyMutation.mutate(paste)
    }
  }

  if (unverifiedEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Email não verificado</h2>
          <p className="text-gray-500 text-sm mb-1">Enviámos um link de confirmação para:</p>
          <p className="font-semibold text-gray-800 mb-6">{unverifiedEmail}</p>
          <p className="text-gray-500 text-sm mb-6">Clica no link no email para activar a conta antes de entrar.</p>
          <div className="space-y-3">
            <Button className="w-full" onClick={() => resendMutation.mutate()} loading={resendMutation.isPending}>
              Reenviar email de verificação
            </Button>
            <button onClick={() => setUnverifiedEmail(null)} className="block w-full text-sm text-gray-400 hover:text-gray-600 text-center">
              ← Voltar ao login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-2">
            <img src="/logo-preto.png" alt="Rungundum" className="h-64 w-auto" />
          </div>
          <p className="text-gray-400 text-sm">Gestão profissional de raids para moto clubes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {logoutReason && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
              {logoutReason}
            </div>
          )}
          {!pendingToken ? (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Entrar na conta</h2>
              <form onSubmit={handleSubmit((d) => loginMutation.mutate(d))} className="space-y-4">
                <Input label="Email" type="email" placeholder="admin@meuclube.pt" error={errors.email?.message} {...register('email')} />
                <div>
                  <Input label="Senha" type="password" placeholder="••••••••" error={errors.password?.message} {...register('password')} />
                  <div className="text-right mt-1">
                    <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-gray-600">
                      Esqueci a senha
                    </Link>
                  </div>
                </div>
                <Button type="submit" className="w-full mt-2" loading={loginMutation.isPending}>
                  Continuar
                </Button>
              </form>
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500">
                  Ainda não tem conta?{' '}
                  <Link to="/register" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                    Registar o meu clube
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <Mail size={22} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verificação em 2 passos</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enviámos um código de 6 dígitos para o teu email. Válido por 10 minutos.
                </p>
              </div>

              <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { codeRefs.current[idx] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeInput(idx, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                    className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-current transition-colors"
                    style={{ borderColor: digit ? 'var(--accent)' : undefined }}
                    disabled={verifyMutation.isPending}
                  />
                ))}
              </div>

              {verifyMutation.isPending && (
                <div className="flex justify-center mb-4">
                  <div className="animate-spin w-5 h-5 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
                </div>
              )}

              <button
                onClick={() => setPendingToken(null)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 text-center"
              >
                ← Voltar ao login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
