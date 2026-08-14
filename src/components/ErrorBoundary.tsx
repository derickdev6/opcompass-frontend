import { Component } from "react"
import type { ErrorInfo, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import ErrorPage from "@/pages/ErrorPage"

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time crashes so a bug in one screen shows an error page
 * instead of a blank white document.
 *
 * Still a class component: React has no hook equivalent of
 * componentDidCatch.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No error-reporting service is wired up yet; the console is the only
    // record. Send this somewhere real before relying on it in production.
    console.error("Unhandled UI error:", error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <ErrorPage
        code={500}
        title="Something went wrong"
        message="This screen failed to render. Reloading usually clears it."
        detail={import.meta.env.DEV ? `${error.name}: ${error.message}` : undefined}
        action={
          <>
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Back to dashboard
            </Button>
          </>
        }
      />
    )
  }
}
