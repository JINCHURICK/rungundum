import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Bike } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const schema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function ResetPassword() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (data: FormData) => axios.post('/api/auth/reset-password', { token, password: data.password }),
    onSuccess: () => {
      toast.success('Senha actualizada! Podes fazer login.')
      navigate('/login')
    },
    onError: (err: any) => toast.error(err.response?.data?.error ?? 'Link inválido ou expirado.'),
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: 'var(--accent)' }}>
            <Bike size={24} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Nova senha</h2>
          <p className="text-sm text-gray-500 mb-6">Define a tua nova senha de acesso.</p>

          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <Input
              label="Nova senha"
              type="password"
              placeholder="Mínimo 8 caracteres"
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirmar nova senha"
              type="password"
              placeholder="Repetir senha"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
            <Button type="submit" className="w-full" loading={mutation.isPending}>
              Definir nova senha
            </Button>
          </form>

          <Link to="/login" className="block text-center mt-4 text-sm text-gray-500 hover:text-gray-700">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  )
}
