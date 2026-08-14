import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Employment and position statuses.
 *
 * Colour is never the only signal — the label is always present, so a
 * colour-blind reader loses nothing.
 */
const TONE: Record<string, string> = {
  ACTIVE: "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  FILLED: "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  PROBATION: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  ONBOARDING: "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  PREBOARDING: "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  OPEN: "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  ON_LEAVE: "border-transparent bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  SUSPENDED: "border-transparent bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  FROZEN: "border-transparent bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  OFFBOARDING: "border-transparent bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  TERMINATED: "border-transparent bg-muted text-muted-foreground",
  CLOSED: "border-transparent bg-muted text-muted-foreground",
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", TONE[status])}>
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  )
}
