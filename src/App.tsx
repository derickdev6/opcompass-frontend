import { AuthProvider, useAuth } from "@/lib/auth"
import LoginPage from "@/pages/LoginPage"
import WelcomePage from "@/pages/WelcomePage"

/**
 * There is no router yet — with two screens, "signed in or not" decides which
 * one renders. Add react-router when a third screen needs its own URL.
 */
function Screen() {
  const { user, isLoading } = useAuth()

  // Wait for the start-up refresh to settle. Without this, a reload would flash
  // the login screen before the restored session arrives.
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return user ? <WelcomePage /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Screen />
    </AuthProvider>
  )
}
