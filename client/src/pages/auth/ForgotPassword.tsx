import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { Bike, ArrowLeft, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () => axios.post('/api/auth/forgot-password', { email }),
    onSuccess: () => setSent(true),
  })

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: 'var(--accent)' }}>
            <Bike size={24} />
          </div>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Email enviado</h2>
            <p className="text-sm text-gray-500 mb-6">
              Se o endereço <strong>{email}</strong> estiver registado, receberás um link de recuperação em breve.
            </p>
            <Link to="/login" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              ← Voltar ao login
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Recuperar senha</h2>
            <p className="text-sm text-gray-500 mb-6">Indica o email da tua conta e enviaremos um link de recuperação.</p>

            <form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="o.meu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" loading={mutation.isPending}>
                Enviar link de recuperação
              </Button>
            </form>

            <Link to="/login" className="flex items-center justify-center gap-1.5 mt-4 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
