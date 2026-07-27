import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Dashboard from '@/pages/dashboard/Dashboard'
import ClubConfig from '@/pages/club/ClubConfig'
import MembersList from '@/pages/members/MembersList'
import MemberDetail from '@/pages/members/MemberDetail'
import RaidsList from '@/pages/raids/RaidsList'
import RaidWizard from '@/pages/raids/wizard/RaidWizard'
import RaidDetail from '@/pages/raids/RaidDetail'
import Invite from '@/pages/auth/Invite'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import VerifyEmail from '@/pages/auth/VerifyEmail'
import MyProfile from '@/pages/profile/MyProfile'
import PublicRaid from '@/pages/public/PublicRaid'
import Stats from '@/pages/stats/Stats'
import Subscription from '@/pages/settings/Subscription'
import Quotas from '@/pages/quotas/Quotas'
import Disciplinary from '@/pages/club/Disciplinary'
import Positions from '@/pages/club/Positions'
import Sms from '@/pages/club/Sms'
import Treasury from '@/pages/treasury/Treasury'
import Announcements from '@/pages/announcements/Announcements'
import PlatformLayout from '@/components/layout/PlatformLayout'
import PlatformDashboard from '@/pages/platform-admin/PlatformDashboard'
import PlatformClubs from '@/pages/platform-admin/PlatformClubs'
import PlatformClubDetail from '@/pages/platform-admin/PlatformClubDetail'
import PlatformSubscriptions from '@/pages/platform-admin/PlatformSubscriptions'
import PlatformRequests from '@/pages/platform-admin/PlatformRequests'
import PlatformPlans from '@/pages/platform-admin/PlatformPlans'
import LandingPage from '@/pages/LandingPage'

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin w-7 h-7 border-2 border-gray-200 rounded-full" style={{ borderTopColor: 'var(--accent)' }} />
  </div>
)

function ProtectedLayout() {
  const { isAuthenticated, initialized } = useAuthStore()
  if (!initialized) return <Spinner />
  if (!isAuthenticated()) return <Navigate to="/login" replace />
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
      } catch {
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
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/public/:token" element={<PublicRaid />} />

        <Route path="/" element={<LandingPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/club" element={<ClubConfig />} />
          <Route path="/members" element={<MembersList />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/raids" element={<RaidsList />} />
          <Route path="/raids/new" element={<RaidWizard />} />
          <Route path="/raids/:id" element={<RaidDetail />} />
          <Route path="/raids/:id/edit" element={<RaidWizard />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings/subscription" element={<Subscription />} />
          <Route path="/quotas" element={<Quotas />} />
          <Route path="/disciplinary" element={<Disciplinary />} />
          <Route path="/positions" element={<Positions />} />
          <Route path="/treasury" element={<Treasury />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/sms" element={<Sms />} />
        </Route>

        <Route path="/platform-admin" element={<PlatformAdminRoute><PlatformLayout /></PlatformAdminRoute>}>
          <Route index element={<PlatformDashboard />} />
          <Route path="clubs" element={<PlatformClubs />} />
          <Route path="clubs/:id" element={<PlatformClubDetail />} />
          <Route path="subscriptions" element={<PlatformSubscriptions />} />
          <Route path="requests" element={<PlatformRequests />} />
          <Route path="plans" element={<PlatformPlans />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
