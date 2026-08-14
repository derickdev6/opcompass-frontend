import { Skeleton } from "@/components/ui/skeleton"

/**
 * The three states every list screen has to handle. Centralised so no screen
 * quietly renders an empty table when the request actually failed.
 */
export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="p-8 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        If this keeps happening, check that the API is running.
      </p>
    </div>
  )
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm font-medium">{message}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}
