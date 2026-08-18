import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"

import DayStrip from "@/components/attendance/DayStrip"
import { ErrorState, LoadingRows } from "@/components/DataState"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { query } from "@/lib/api"
import type { AttendanceSummary } from "@/lib/types"
import { useApi } from "@/lib/useApi"

/** Local date, not UTC — `toISOString()` shifts the day west of Greenwich. */
function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * The calendar week containing today, Monday to Sunday.
 *
 * Deliberately not the trailing seven days: "this week" is a thing people say
 * to each other, and it has a Monday. Days still to come are part of the
 * window and come back as `FUTURE`, drawn as empty shells.
 */
function currentWeek(): { from: string; to: string } {
  const today = new Date()
  // getDay() is Sunday-first; shift so Monday starts the week.
  const offset = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - offset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { from: iso(monday), to: iso(sunday) }
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]

export default function WeekAttendance() {
  const week = currentWeek()
  const { data, error, isLoading } = useApi<AttendanceSummary>(
    `/attendance/${query({ from: week.from, to: week.to })}`,
  )

  // Busiest first: a dashboard panel earns its space by surfacing the problem,
  // not by listing everyone alphabetically.
  const incidents = (row: (typeof people)[number]) =>
    row.late_count + row.early_count + row.absent_count
  const people = [...(data?.people ?? [])].sort(
    (a, b) => incidents(b) - incidents(a) || a.name.localeCompare(b.name),
  )

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">This week's attendance</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Monday to Sunday
              {data ? ` · ${data.totals.late + data.totals.early + data.totals.absent} incidents` : ""}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/attendance">
              Open
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </CardHeader>

      {/* Fixed height, so the panel does not grow with headcount. */}
      <CardContent className="h-[500px] overflow-y-auto p-0">
        {isLoading ? (
          <LoadingRows rows={6} />
        ) : error ? (
          <ErrorState message={error} />
        ) : people.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nobody to show yet.</p>
        ) : (
          <ul className="divide-y">
            <li className="sticky top-0 z-10 flex items-center gap-3 bg-card px-4 py-2">
              <span className="flex-1" />
              <span className="flex gap-[3px]" aria-hidden>
                {WEEKDAYS.map((letter, index) => (
                  <span
                    key={index}
                    className="w-[7px] text-center text-[10px] leading-none text-muted-foreground"
                  >
                    {letter}
                  </span>
                ))}
              </span>
            </li>
            {people.map((person) => (
              <li key={person.employment} className="flex items-center gap-3 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{person.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {person.org_unit_name ?? "Unassigned"}
                  </div>
                </div>
                <DayStrip days={person.days} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
