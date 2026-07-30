import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  role: string
  memberId?: string
  platformAdmin?: boolean
  photoUrl?: string | null
}

interface Club {
  id: string
  name: string
  acronym: string
  accentColor: string
  logoUrl?: string | null
}

// Clube que o platform admin está a gerir temporariamente (cross-club access)
interface ViewingClub {
  id: string
  name: string
  acronym: string
  accentColor: string
  logoUrl?: string | null
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  club: Club | null
  viewingClub: ViewingClub | null   // apenas platform admins, ao gerir outro clube
  initialized: boolean
  setAuth: (data: { accessToken: string; refreshToken: string; user: User; club: Club | null }) => void
  setAccessToken: (token: string) => void
  setInitialized: (v: boolean) => void
  setViewingClub: (club: ViewingClub | null) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      club: null,
      viewingClub: null,
      initialized: false,
      setAuth: (data) => {
        set({ ...data, viewingClub: null })
        const accentColor = data.club?.accentColor
        if (accentColor) {
          document.documentElement.style.setProperty('--accent', accentColor)
        }
      },
      setAccessToken: (token) => set({ accessToken: token }),
      setInitialized: (v) => set({ initialized: v }),
      setViewingClub: (club) => {
        set({ viewingClub: club })
        // Aplicar cor do clube que está a ser gerido
        const accentColor = club?.accentColor ?? get().club?.accentColor
        if (accentColor) {
          document.documentElement.style.setProperty('--accent', accentColor)
        }
      },
      logout: () => set({ accessToken: null, refreshToken: null, user: null, club: null, viewingClub: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: 'rungundum-auth',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
        club: state.club,
        viewingClub: state.viewingClub,
      }),
    }
  )
)
