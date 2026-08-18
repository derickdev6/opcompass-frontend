import { ArrowRight, UserPlus, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import NewHireDialog from "@/components/dashboard/NewHireDialog"
import WeekAttendance from "@/components/dashboard/WeekAttendance"
import { ErrorState, LoadingRows } from "@/components/DataState"
import ModuleSection from "@/components/ModuleSection"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Headcount } from "@/lib/types"
import { useApi } from "@/lib/useApi"

/**
 * The dashboard is a stack of module blocks, one per module, each introduced by
 * its own heading and rule. Only People exists today; when Assets or Finance
 * land they become additional <ModuleSection> blocks below this one, and the
 * page needs no other change.
 */
export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="The headline numbers from each module."
      />
      <PeopleModule />
    </>
  )
}

function PeopleModule() {
  const { data, error, isLoading, reload } = useApi<Headcount>("/headcount/")
  const [hiring, setHiring] = useState(false)

  return (
    <ModuleSection
      name="People"
      reference="§5"
      icon={Users}
      description="Headcount, organisation structure and the employee directory."
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/directory">
            Open directory
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      }
    >
      {/* Quick flows, where the stat cards used to be. Only the new hire is
          defined so far; further flows are more cards in this grid. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickFlow
          label="New hire"
          description="Job title, seat, person and employment in five steps."
          icon={UserPlus}
          onClick={() => setHiring(true)}
        />
      </div>

      {isLoading ? (
        <LoadingRows rows={4} />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? null : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <WeekAttendance />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By employment type</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList
                items={Object.entries(data.by_employment_type).map(([label, value]) => ({
                  label: label.replace(/_/g, " ").toLowerCase(),
                  value,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <NewHireDialog
        open={hiring}
        onOpenChange={setHiring}
        onFinished={reload}
      />
    </ModuleSection>
  )
}

/** A card that starts a guided flow, rather than reporting a number. */
function QuickFlow({
  label,
  description,
  icon: Icon,
  onClick,
}: {
  label: string
  description: string
  icon: LucideIcon
  onClick: () => void
}) {
  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="py-5">
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </button>
      </CardContent>
    </Card>
  )
}

/**
 * A labelled bar list rather than a chart library: with a handful of
 * categories this reads better than a pie and needs no dependency.
 */
function BarList({ items }: { items: { label: string; value: number }[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
  }
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate capitalize">{item.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.value}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
