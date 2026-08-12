import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

interface Welcome {
  message: string
  user: string
}

export default function WelcomePage() {
  const { user, logout } = useAuth()
  const [welcome, setWelcome] = useState<Welcome | null>(null)

  useEffect(() => {
    let cancelled = false

    void api
      .get<Welcome>("/welcome/")
      .then((data) => {
        if (!cancelled) setWelcome(data)
      })
      .catch(() => {
        if (!cancelled) setWelcome(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-6">
          <span className="font-semibold tracking-tight">OP Compass</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>{welcome?.message ?? "Welcome to OP Compass."}</CardTitle>
            <CardDescription>
              You are signed in. There is nothing else here yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This page exists to prove the frontend and the API are talking to
            each other. Features get built from here.
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
