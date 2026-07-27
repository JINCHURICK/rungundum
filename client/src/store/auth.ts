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
  logoUrl?: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  club: Club | null
  initialized: boolean
  setAuth: (data: { accessToken: string; refreshToken: string; user: User; club: Club }) => void
  setAccessToken: (token: string) => void
  setInitialized: (v: boolean) => void
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
      initialized: false,
      setAuth: (data) => {
        set(data)
        if (data.club?.accentColor) {
          document.documentElement.style.setProperty('--accent', data.club.accentColor)
        }
      },
      setAccessToken: (token) => set({ accessToken: token }),
      setInitialized: (v) => set({ initialized: v }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null, club: null }),
      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: 'rungundum-auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user, club: state.club }),
    }
  )
)
