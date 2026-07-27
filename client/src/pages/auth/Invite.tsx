import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Bike, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function Invite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => axios.get(`/api/auth/invite/${token}`).then((r) => r.data),
    retry: false,
  })

  useEffect(() => {
    if (info?.clubAccentColor) {
      document.documentElement.style.setProperty('--accent', info.clubAccentColor)
    }
  }, [info?.clubAccentColor])

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      axios.post(`/api/auth/invite/${token}`, { email: data.email, password: data.password }).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data)
      toast.success(`Bem-vindo, ${info?.memberName}!`)
      navigate('/dashboard')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao criar conta'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
      </div>
    )
  }

  if (isError || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Convite inválido</h2>
          <p className="text-sm text-gray-500">Este link de convite expirou ou já foi utilizado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 text-white">
        <div className="flex items-center gap-3 mb-12">
          {info.clubLogoUrl ? (
            <img src={info.clubLogoUrl} alt={info.clubName} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <Bike className="w-6 h-6" />
            </div>
          )}
          <span className="text-xl font-bold">{info.clubName}</span>
        </div>
        <h2 className="text-4xl font-bold mb-4 leading-tight">
          Olá, {info.memberName.split(' ')[0]}!
        </h2>
        <p className="text-gray-400 mb-8">
          Foste convidado para o <strong className="text-white">{info.clubName}</strong>.<br />
          Cria a tua conta para aceder ao Rungundum.
        </p>
        <ul className="space-y-3">
          {['Confirmar presença nos raids', 'Checklist digital por piloto', 'Histórico das tuas participações'].map((f) => (
            <li key={f} className="flex items-center gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          {/* Mobile header */}
          <div className="flex items-center gap-3 mb-6 lg:hidden">
            {info.clubLogoUrl ? (
              <img src={info.clubLogoUrl} alt={info.clubName} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                <Bike className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">{info.clubName}</p>
              <p className="font-bold text-gray-900">Convite de adesão</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-1">Criar a minha conta</h2>
          <p className="text-sm text-gray-500 mb-6">
            Bem-vindo, <strong>{info.memberName}</strong>. Define o teu email e senha de acesso.
          </p>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="o.meu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Mínimo 8 caracteres"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar senha"
              type="password"
              placeholder="Repetir senha"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              Criar conta e entrar →
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
