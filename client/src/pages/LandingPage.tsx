import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Shield, Map, Users, BarChart2, Bell, CheckCircle2, ArrowRight, Star, Bike, LayoutDashboard } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api'

// Muda para true para mostrar a secção de preços/planos na landing page
const SHOW_PRICING = true


const features = [
  {
    icon: Map,
    title: 'Gestão completa de raids',
    desc: 'Planeia rotas, pontos de paragem, checklist de segurança e documentação. Partilha o raid com um link público.',
  },
  {
    icon: Users,
    title: 'Gestão de membros',
    desc: 'Controlo de membros activos, convites por email, veículos registados e informações de emergência.',
  },
  {
    icon: BarChart2,
    title: 'Estatísticas avançadas',
    desc: 'Relatórios de actividade, quilómetros percorridos, participações por membro e evolução do clube.',
  },
  {
    icon: Bell,
    title: 'Notificações por email',
    desc: 'Confirmações de presença, lembretes de raids, alertas de quotas em atraso e muito mais.',
  },
  {
    icon: Shield,
    title: 'Plano de contingência',
    desc: 'Define procedimentos de emergência, pontos de reagrupamento e contactos de socorro por raid.',
  },
]

const testimonials = [
  { name: 'Pr. Hiko', club: 'Amigos do Capim', text: 'Finalmente uma solução que percebe as necessidades de um moto clube angolano. Tudo numa plataforma.' },
  { name: 'Pr. Emerson', club: 'Papis do Trilho', text: 'A gestão de raids ficou muito mais organizada. Os membros adoram receber as confirmações por email.' },
  { name: 'Pr. Lilio', club: 'Amigos da Picada', text: 'O plano de contingência é essencial. Dá-nos muito mais tranquilidade nas saídas longas.' },
]

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore()
  const loggedIn = isAuthenticated()

  const { data: dbPlans = [], isLoading: dbPlansLoading } = useQuery<any[]>({
    queryKey: ['plans-public'],
    queryFn:  () => api.get('/plans').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const [landingBilling, setLandingBilling] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')


  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo-branco.png" alt="Rungundum" className="h-14 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                <LayoutDashboard size={15} />
                Ir para a plataforma
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-2">
                  Entrar
                </Link>
                <Link to="/register" className="text-sm font-medium bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                  Registar clube
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-red-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-red-500 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 rounded-full bg-red-600 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Bike size={12} />
              Plataforma nº1 para moto clubes em Angola
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Gestão profissional<br />
              <span className="text-red-500">de Clubes Motard</span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
              Planeia raids, gere membros, controla quotas e acompanha o desempenho do clube — tudo numa plataforma feita especificamente para moto clubes angolanos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {loggedIn ? (
                <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm">
                  <LayoutDashboard size={16} />
                  Ir para a plataforma
                </Link>
              ) : (
                <>
                  <Link to="/register" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm">
                    Começar gratuitamente
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3.5 rounded-xl transition-colors text-sm border border-white/10">
                    Já tenho conta
                  </Link>
                </>
              )}
            </div>
            {!loggedIn && <p className="text-xs text-gray-500 mt-4">14 dias de trial gratuito. Sem pagar nada.</p>}
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-3 gap-4">
            {[
              { value: '14 dias', label: 'Trial gratuito' },
              { value: '100%', label: 'Feito para Angola' },
              { value: '24/7', label: 'Acesso à plataforma' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tudo o que o teu clube precisa
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Uma plataforma completa, desenvolvida para resolver os desafios reais dos moto clubes angolanos.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
                  <f.icon size={22} className="text-red-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — controlado pela constante SHOW_PRICING no topo do ficheiro */}
      {SHOW_PRICING && (
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Planos</h2>
              <p className="text-gray-500 text-lg mb-1">Todos os recursos incluídos. Cresce ao teu ritmo.</p>
              <p className="text-sm text-gray-400 mb-8">14 dias de trial gratuito · Sem pagar nada</p>
              <div className="inline-flex items-center bg-gray-100 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setLandingBilling('MONTHLY')}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${landingBilling === 'MONTHLY' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setLandingBilling('ANNUAL')}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all ${landingBilling === 'ANNUAL' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Anual
                  <span className="text-xs font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">2 meses grátis</span>
                </button>
              </div>
            </div>

            {dbPlansLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-gray-200 rounded-full" style={{ borderTopColor: '#dc2626' }} />
              </div>
            ) : (
              <div className="grid gap-5 max-w-5xl mx-auto md:grid-cols-4">
                {dbPlans.map((p: any) => {
                  const isPopular = p.code === 'comitiva'
                  const price     = landingBilling === 'ANNUAL' ? p.priceAnnualKz : p.priceMonthlyKz
                  const savings   = Math.round(100 - (p.priceAnnualKz / (p.priceMonthlyKz * 12)) * 100)

                  return (
                    <div
                      key={p.code}
                      className={`rounded-2xl border flex flex-col overflow-hidden ${isPopular
                        ? 'bg-red-600 border-red-600 shadow-2xl shadow-red-200'
                        : 'bg-white border-gray-200 shadow-sm'
                      }`}
                    >
                      {isPopular && (
                        <div className="px-4 py-2 bg-white/15 text-center">
                          <span className="text-xs font-bold text-white flex items-center justify-center gap-1">
                            <Star size={10} fill="currentColor" /> Mais popular
                          </span>
                        </div>
                      )}

                      <div className="p-6 flex flex-col flex-1">
                        <h3 className={`text-lg font-bold mb-0.5 ${isPopular ? 'text-white' : 'text-gray-900'}`}>{p.name}</h3>
                        <p className={`text-xs mb-4 ${isPopular ? 'text-red-200' : 'text-gray-400'}`}>
                          {p.memberLimit !== null ? `Até ${p.memberLimit} membros` : 'Membros ilimitados'}
                        </p>

                        <div className="mb-5">
                          <div className="flex items-end gap-1 flex-wrap">
                            <span className={`text-3xl font-extrabold ${isPopular ? 'text-white' : 'text-gray-900'}`}>
                              {price.toLocaleString('pt-AO')}
                            </span>
                            <span className={`text-sm pb-1 ${isPopular ? 'text-red-200' : 'text-gray-400'}`}>Kz/mês</span>
                          </div>
                          {landingBilling === 'ANNUAL' && (
                            <p className={`text-xs mt-0.5 ${isPopular ? 'text-red-200' : 'text-gray-400'}`}>
                              {p.priceAnnualKz.toLocaleString('pt-AO')} Kz/ano <span className="text-green-400 font-semibold">(-{savings}%)</span>
                            </p>
                          )}
                        </div>

                        <ul className="space-y-2 mb-6 flex-1">
                          {['Todos os recursos', 'Raids ilimitados', 'SMS e email', 'Tesouraria', 'Processos disciplinares', 'Suporte'].map(feat => (
                            <li key={feat} className="flex items-center gap-2 text-xs">
                              <CheckCircle2 size={13} className={isPopular ? 'text-red-200 shrink-0' : 'text-green-500 shrink-0'} />
                              <span className={isPopular ? 'text-red-100' : 'text-gray-500'}>{feat}</span>
                            </li>
                          ))}
                        </ul>

                        <Link
                          to={loggedIn ? '/settings/subscription' : '/register'}
                          className={`block text-center text-sm font-semibold py-3 rounded-xl transition-colors ${
                            isPopular ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          {loggedIn ? 'Ver planos' : 'Começar trial gratuito'}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">O que dizem os nossos clubes</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-1 mb-4">
                  {[1,2,3,4,5].map((s) => <Star key={s} size={14} className="text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.club}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-red-600 to-red-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          {loggedIn ? (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Bem-vindo de volta!</h2>
              <p className="text-red-100 text-lg mb-8">Continua a gerir o teu clube na plataforma.</p>
              <Link to="/dashboard" className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-8 py-4 rounded-xl hover:bg-red-50 transition-colors text-sm shadow-lg">
                <LayoutDashboard size={16} />
                Ir para o dashboard
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Pronto para levar o teu clube ao próximo nível?
              </h2>
              <p className="text-red-100 text-lg mb-2">
                Regista o teu clube e começa o trial gratuito de 14 dias.
              </p>
              <p className="text-red-200 text-sm mb-8">Sem pagar nada. Cancela quando quiseres.</p>
              <Link to="/register" className="inline-flex items-center gap-2 bg-white text-red-600 font-bold px-8 py-4 rounded-xl hover:bg-red-50 transition-colors text-sm shadow-lg">
                Começar trial gratuito
                <ArrowRight size={16} />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/logo-preto.png" alt="Rungundum" className="h-14 w-auto" />
          </div>
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Rungundum · A plataforma para gestão de motocubes em Angola</p>
          <div className="flex gap-4">
            {loggedIn ? (
              <Link to="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Ir para a plataforma</Link>
            ) : (
              <>
                <Link to="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Entrar</Link>
                <Link to="/register" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Registar</Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
