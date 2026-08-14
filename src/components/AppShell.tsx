import { LogOut } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"

import Sidebar from "@/components/Sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/auth"

const STORAGE_KEY = "opcompass.sidebar.collapsed"

export default function AppShell() {
  const { user, logout } = useAuth()

  // Persisted so the layout does not reset on every navigation or reload.
  // This is UI preference, not a credential — localStorage is the right home
  // for it, unlike tokens.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true",
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((value) => !value), [])

  const initials = (user?.person_name || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-svh overflow-hidden bg-background">
        <Sidebar collapsed={collapsed} onToggle={toggle} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-6">
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium">
                  {user?.person_name || user?.email}
                </p>
                {user?.roles?.length ? (
                  <p className="text-xs text-muted-foreground">
                    {user.roles.map((r) => r.code).join(", ")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {user?.is_superuser ? "Superuser" : "No role assigned"}
                  </p>
                )}
              </div>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                aria-label="Sign out"
              >
                <LogOut className="size-4" aria-hidden />
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
