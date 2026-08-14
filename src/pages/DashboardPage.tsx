import { ArrowRight, Briefcase, DoorOpen, MapPinned, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

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
  const { data, error, isLoading } = useApi<Headcount>("/headcount/")

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
      {isLoading ? (
        <LoadingRows rows={4} />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total headcount"
              value={data.total}
              icon={Users}
              to="/employments"
            />
            <StatCard
              label="Active"
              value={data.by_status.ACTIVE ?? 0}
              icon={Briefcase}
              to="/directory"
            />
            <StatCard
              label="Open positions"
              value={data.open_positions}
              icon={DoorOpen}
              to="/positions"
            />
            <StatCard
              label="Remote"
              value={data.by_work_mode.REMOTE ?? 0}
              icon={MapPinned}
              to="/directory"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Headcount by org unit</CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_org_unit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No one is assigned to a position yet.
                  </p>
                ) : (
                  <BarList
                    items={data.by_org_unit.map((row) => ({
                      label: row.position__org_unit__name,
                      value: row.headcount,
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By employment type</CardTitle>
              </CardHeader>
              <CardContent>
                <BarList
                  items={Object.entries(data.by_employment_type).map(
                    ([label, value]) => ({
                      label: label.replace(/_/g, " ").toLowerCase(),
                      value,
                    }),
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </ModuleSection>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string
  value: number
  icon: LucideIcon
  to: string
}) {
  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardContent className="py-5">
        <Link to={to} className="flex items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        </Link>
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
