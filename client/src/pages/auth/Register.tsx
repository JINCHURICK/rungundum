import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import axios from 'axios'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CheckCircle, Mail, Crown, Settings } from 'lucide-react'

const schema = z.object({
  clubName: z.string().min(2, 'Nome do clube obrigatório'),
  clubAcronym: z.string().min(1).max(10, 'Máx. 10 caracteres'),
  clubLocation: z.string().min(2, 'Localidade obrigatória'),
  fullName: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
  role: z.enum(['ADMIN', 'APP_ADMIN']),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

const ROLE_OPTIONS = [
  {
    value: 'ADMIN' as const,
    label: 'Presidente',
    description: 'Fundador e responsável máximo do clube',
    Icon: Crown,
  },
  {
    value: 'APP_ADMIN' as const,
    label: 'Adm. App',
    description: 'Administrador técnico com acesso total à aplicação',
    Icon: Settings,
  },
]

const features = [
  'Raids criados em menos de 15 minutos',
  'PDF com identidade visual do clube',
  'Checklists digitais por piloto',
  'Histórico e estatísticas',
]

export default function Register() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'ADMIN' },
  })

  const mutation = useMutation({
    mutationFn: (data: FormData) => axios.post('/api/auth/register', data).then((r) => r.data),
    onSuccess: (data: any, variables) => {
      if (data.requiresVerification) {
        setRegisteredEmail(variables.email)
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Erro ao registar'),
  })

  const resendMutation = useMutation({
    mutationFn: () => axios.post('/api/auth/resend-verification', { email: registeredEmail }).then((r) => r.data),
    onSuccess: () => toast.success('Email reenviado! Verifica a caixa de entrada.'),
    onError: () => toast.error('Erro ao reenviar. Tenta mais tarde.'),
  })

  if (registeredEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Verifica o teu email</h2>
          <p className="text-gray-500 text-sm mb-2">
            Enviámos um link de confirmação para
          </p>
          <p className="font-semibold text-gray-800 mb-6">{registeredEmail}</p>
          <p className="text-gray-500 text-sm mb-8">
            Clica no link no email para activar a tua conta e entrar no Rungundum. O link expira em 24 horas.
          </p>
          <div className="space-y-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => resendMutation.mutate()}
              loading={resendMutation.isPending}
            >
              Reenviar email
            </Button>
            <Link to="/login" className="block text-sm text-gray-400 hover:text-gray-600 text-center">
              ← Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 text-white">
        <div className="flex items-center gap-3 mb-12">
          <img src="/logo-preto.png" alt="Rungundum" className="h-14 w-auto" />
        </div>
        <h2 className="text-4xl font-bold mb-4 leading-tight">O seu clube.<br />Os seus raids.<br />Profissional.</h2>
        <p className="text-gray-400 mb-8">Digitalize a gestão dos raids do seu moto clube em minutos.</p>
        <ul className="space-y-3">
          {features.map((f) => (
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
          <h2 className="text-xl font-bold text-gray-900 mb-1">Registar o meu clube</h2>
          <p className="text-sm text-gray-500 mb-6">7 dias grátis. Sem pagar nada.</p>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nome do clube" placeholder="Moto Clube..." error={errors.clubName?.message} {...register('clubName')} className="col-span-2" />
              <Input label="Sigla (acrónimo)" placeholder="MCX" error={errors.clubAcronym?.message} {...register('clubAcronym')} />
              <Input label="Localidade" placeholder="Luanda" error={errors.clubLocation?.message} {...register('clubLocation')} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Conta do Administrador</p>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Papel no sistema</p>
                  <Controller
                    name="role"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {ROLE_OPTIONS.map(({ value, label, description, Icon }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={[
                              'flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all',
                              field.value === value
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300',
                            ].join(' ')}
                          >
                            <Icon className={`w-4 h-4 ${field.value === value ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-semibold ${field.value === value ? 'text-blue-700' : 'text-gray-700'}`}>{label}</span>
                            <span className="text-xs text-gray-400 leading-snug">{description}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
                <Input label="Nome completo" placeholder="João Silva" error={errors.fullName?.message} {...register('fullName')} />
                <Input label="Email" type="email" placeholder="joao@clube.ao" error={errors.email?.message} {...register('email')} />
                <Input label="Senha" type="password" placeholder="Mínimo 8 caracteres" error={errors.password?.message} {...register('password')} />
                <Input label="Confirmar senha" type="password" placeholder="Repetir senha" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
              </div>
            </div>

            <Button type="submit" className="w-full" loading={mutation.isPending}>
              Criar o meu clube →
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
