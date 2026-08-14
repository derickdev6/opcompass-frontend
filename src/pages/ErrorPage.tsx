import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

interface ErrorPageProps {
  code: number | string
  title: string
  message: string
  /** Rendered instead of the default "Back to dashboard" action. */
  action?: React.ReactNode
  /** Shown in a collapsed block — only ever developer detail, never raw server text. */
  detail?: string
}

/**
 * The standard full-page error screen.
 *
 * One component for 403, 404 and the crash boundary, so every failure looks the
 * same and there is one place to change the wording.
 */
export default function ErrorPage({
  code,
  title,
  message,
  action,
  detail,
}: ErrorPageProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-5xl font-semibold tracking-tight tabular-nums text-muted-foreground/50">
          {code}
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>

        {detail && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical detail
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md border bg-card p-3 text-left text-xs">
              {detail}
            </pre>
          </details>
        )}

        <div className="mt-6 flex justify-center gap-2">
          {action ?? (
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code={404}
      title="Page not found"
      message="That page does not exist, or it moved."
    />
  )
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code={403}
      title="No access"
      message="Your role does not include this area. Ask an administrator if you think you should have it."
    />
  )
}
