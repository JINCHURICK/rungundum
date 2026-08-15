import React, { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/layout/Layout'
import PlatformLayout from '@/components/layout/PlatformLayout'

// ── lazy page imports ──────────────────────────────────────────────────────────
const Login               = lazy(() => import('@/pages/auth/Login'))
const Register            = lazy(() => import('@/pages/auth/Register'))
const Invite              = lazy(() => import('@/pages/auth/Invite'))
const ForgotPassword      = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword       = lazy(() => import('@/pages/auth/ResetPassword'))
const VerifyEmail         = lazy(() => import('@/pages/auth/VerifyEmail'))
const Dashboard           = lazy(() => import('@/pages/dashboard/Dashboard'))
const ClubConfig          = lazy(() => import('@/pages/club/ClubConfig'))
const MembersList         = lazy(() => import('@/pages/members/MembersList'))
const MemberDetail        = lazy(() => import('@/pages/members/MemberDetail'))
const RaidsList           = lazy(() => import('@/pages/raids/RaidsList'))
const RaidWizard          = lazy(() => import('@/pages/raids/wizard/RaidWizard'))
const RaidDetail          = lazy(() => import('@/pages/raids/RaidDetail'))
const MyProfile           = lazy(() => import('@/pages/profile/MyProfile'))
const PublicRaid          = lazy(() => import('@/pages/public/PublicRaid'))
const Stats               = lazy(() => import('@/pages/stats/Stats'))
const Subscription        = lazy(() => import('@/pages/settings/Subscription'))
const Quotas              = lazy(() => import('@/pages/quotas/Quotas'))
const Disciplinary        = lazy(() => import('@/pages/club/Disciplinary'))
const Positions           = lazy(() => import('@/pages/club/Positions'))
const Sms                 = lazy(() => import('@/pages/club/Sms'))
const Treasury            = lazy(() => import('@/pages/treasury/Treasury'))
const Announcements       = lazy(() => import('@/pages/announcements/Announcements'))
const PlatformDashboard   = lazy(() => import('@/pages/platform-admin/PlatformDashboard'))
const PlatformClubs       = lazy(() => import('@/pages/platform-admin/PlatformClubs'))
const PlatformClubDetail  = lazy(() => import('@/pages/platform-admin/PlatformClubDetail'))
const PlatformSubscriptions = lazy(() => import('@/pages/platform-admin/PlatformSubscriptions'))
const PlatformRequests    = lazy(() => import('@/pages/platform-admin/PlatformRequests'))
const PlatformPlans           = lazy(() => import('@/pages/platform-admin/PlatformPlans'))
const PlatformPaymentRequests = lazy(() => import('@/pages/platform-admin/PlatformPaymentRequests'))
const LandingPage             = lazy(() => import('@/pages/LandingPage'))
const SubscriptionExpired     = lazy(() => import('@/pages/SubscriptionExpired'))
const SubscriptionPay         = lazy(() => import('@/pages/SubscriptionPay'))

// ── loading fallback ───────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
  </div>
)

// ── error boundary ─────────────────────────────────────────────────────────────

interface EBState { error: Error | null }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null }

  static getDerivedStateFromError(error: Error): EBState { return { error } }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-gray-500 text-sm max-w-xs">Algo correu mal. Tenta recarregar a página.</p>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── route guards ───────────────────────────────────────────────────────────────

function ProtectedLayout() {
  const { isAuthenticated, initialized, user, club, viewingClub } = useAuthStore()
  if (!initialized) return <Spinner />
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  // Platform admin sem clube próprio e sem clube em gestão → ir para o painel de plataforma
  if (user?.platformAdmin && !club && !viewingClub) {
    return <Navigate to="/platform-admin" replace />
  }
  return <Layout />
}

function PlatformAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) return <Spinner />
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!user?.platformAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, initialized } = useAuthStore()
  if (!initialized) return <Spinner />
  if (isAuthenticated()) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// ── app ────────────────────────────────────────────────────────────────────────

export default function App() {
  const { club, refreshToken, setAccessToken, setInitialized, logout } = useAuthStore()
  const initCalled = useRef(false)

  // Ao arrancar: renovar sessão silenciosamente se existir refreshToken em storage
  useEffect(() => {
    // useRef garante execução única mesmo com React StrictMode (que dispara effects 2× em dev)
    if (initCalled.current) return
    initCalled.current = true

    async function init() {
      if (!refreshToken) {
        setInitialized(true)
        return
      }
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken })
        setAccessToken(data.accessToken)
        if (data.refreshToken) {
          useAuthStore.setState({ refreshToken: data.refreshToken })
        }
      } catch (err: any) {
        const code = err?.response?.data?.code
        if (code === 'SESSION_TERMINATED') {
          sessionStorage.setItem('logout-reason', 'A sua sessão foi terminada por um novo início de sessão noutro dispositivo.')
        } else if (code === 'IDLE_TIMEOUT') {
          sessionStorage.setItem('logout-reason', 'A sessão expirou por inatividade.')
        }
        logout()
      } finally {
        setInitialized(true)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aplicar cor de destaque do clube
  useEffect(() => {
    if (club?.accentColor) {
      document.documentElement.style.setProperty('--accent', club.accentColor)
    }
  }, [club?.accentColor])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/login"                 element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/register"              element={<PublicRoute><Register /></PublicRoute>} />
            <Route path="/invite/:token"         element={<Invite />} />
            <Route path="/forgot-password"       element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token"   element={<VerifyEmail />} />
            <Route path="/public/:token"         element={<PublicRaid />} />

            <Route path="/" element={<LandingPage />} />
            <Route path="/subscription-expired" element={<SubscriptionExpired />} />
            <Route path="/subscription/pay"     element={<SubscriptionPay />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard"               element={<Dashboard />} />
              <Route path="/club"                    element={<ClubConfig />} />
              <Route path="/members"                 element={<MembersList />} />
              <Route path="/members/:id"             element={<MemberDetail />} />
              <Route path="/raids"                   element={<RaidsList />} />
              <Route path="/raids/new"               element={<RaidWizard />} />
              <Route path="/raids/:id"               element={<RaidDetail />} />
              <Route path="/raids/:id/edit"          element={<RaidWizard />} />
              <Route path="/profile"                 element={<MyProfile />} />
              <Route path="/stats"                   element={<Stats />} />
              <Route path="/settings/subscription"  element={<Subscription />} />
              <Route path="/quotas"                  element={<Quotas />} />
              <Route path="/disciplinary"            element={<Disciplinary />} />
              <Route path="/positions"               element={<Positions />} />
              <Route path="/treasury"                element={<Treasury />} />
              <Route path="/announcements"           element={<Announcements />} />
              <Route path="/sms"                     element={<Sms />} />
            </Route>

            <Route path="/platform-admin" element={<PlatformAdminRoute><PlatformLayout /></PlatformAdminRoute>}>
              <Route index                      element={<PlatformDashboard />} />
              <Route path="clubs"               element={<PlatformClubs />} />
              <Route path="clubs/:id"           element={<PlatformClubDetail />} />
              <Route path="subscriptions"       element={<PlatformSubscriptions />} />
              <Route path="requests"            element={<PlatformRequests />} />
              <Route path="payment-requests"   element={<PlatformPaymentRequests />} />
              <Route path="plans"               element={<PlatformPlans />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
