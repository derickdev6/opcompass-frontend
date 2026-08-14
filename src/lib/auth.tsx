/**
 * Session state for the app.
 *
 * On mount the provider attempts a silent refresh. If the HttpOnly cookie is
 * still valid the user stays signed in across a page reload; if not, they see
 * the login screen. `isLoading` covers that window so an authenticated user is
 * never bounced to the login screen for a frame.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { api, refreshSession, setAccessToken } from "@/lib/api"

export interface User {
  id: string
  email: string
  person: string | null
  person_name: string | null
  status: string
  auth_provider: string
  mfa_enabled: boolean
  is_staff: boolean
  is_superuser: boolean
  roles: { code: string; scope_type: string; scope_id: string | null }[]
  /** Flat permission codes for hiding UI the user cannot use. The server
   *  re-checks every request regardless — this is presentation only. */
  permissions: string[]
  last_login_at: string | null
}

interface LoginResponse {
  access: string
  user: User
}

interface AuthContextValue {
  user: User | null
  /** True until the start-up refresh attempt settles. */
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // StrictMode double-invokes effects in development; the flag stops the
    // second run from writing state after the first has been torn down.
    let cancelled = false

    void (async () => {
      if (await refreshSession()) {
        try {
          const me = await api.get<User>("/auth/me/")
          if (!cancelled) setUser(me)
        } catch {
          if (!cancelled) setUser(null)
        }
      }
      if (!cancelled) setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>(
      "/auth/login/",
      { email, password },
      { skipAuthRetry: true },
    )
    setAccessToken(data.access)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/", undefined, { skipAuthRetry: true })
    } finally {
      // Cleared even if the request fails, so the user is never left looking
      // at a signed-in screen after asking to leave.
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider")
  }
  return context
}
