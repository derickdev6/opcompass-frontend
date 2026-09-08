import { Search } from "lucide-react"
import { useState } from "react"

import AttendanceDialog from "@/components/attendance/AttendanceDialog"
import DatePicker from "@/components/attendance/DatePicker"
import DayStrip, { StripLegend } from "@/components/attendance/DayStrip"
import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import FilterMenu from "@/components/list/FilterMenu"
import ListToolbar from "@/components/list/ListToolbar"
import SearchInput from "@/components/list/SearchInput"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { AttendanceRow, AttendanceSummary, OrgUnit } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useDebounced } from "@/lib/useDebounced"

/** The strip draws at most this many bars, so every window is capped to it. */
const MAX_DAYS = 31

type Range = "day" | "week" | "month" | "custom"

/** Local date, not UTC — `toISOString()` shifts the day west of Greenwich. */
function iso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function daysAgo(count: number): string {
  const date = new Date()
  date.setDate(date.getDate() - count)
  return iso(date)
}

function spanInDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime()
  const end = new Date(`${to}T00:00:00Z`).getTime()
  return Math.floor((end - start) / 86_400_000) + 1
}

function pretty(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function AttendancePage() {
  const [range, setRange] = useState<Range>("month")
  const [customFrom, setCustomFrom] = useState(daysAgo(13))
  const [customTo, setCustomTo] = useState(daysAgo(0))
  const [search, setSearch] = useState("")
  const [orgUnits, setOrgUnits] = useState<string[]>([])
  const [editing, setEditing] = useState<AttendanceRow | null>(null)

  // The picker lists every unit, so it cannot come from the paged table.
  const units = useApi<Paginated<OrgUnit>>(
    `/org-units/${query({ page_size: 200, ordering: "code" })}`,
  )

  const debounced = useDebounced(search, 300)

  const period =
    range === "day"
      ? { from: daysAgo(0), to: daysAgo(0) }
      : range === "week"
        ? { from: daysAgo(6), to: daysAgo(0) }
        : range === "month"
          ? { from: daysAgo(MAX_DAYS - 1), to: daysAgo(0) }
          : { from: customFrom, to: customTo }

  // A custom range has to cover at least two days, and cannot outrun the strip.
  const span = spanInDays(period.from, period.to)
  const problem =
    range !== "custom"
      ? null
      : span < 2
        ? "Pick at least two days — one day on its own is the Day view."
        : span > MAX_DAYS
          ? `That range is ${span} days. The strip draws at most ${MAX_DAYS}.`
          : null

  const { data, error, isLoading, reload } = useApi<AttendanceSummary>(
    problem
      ? null
      : `/attendance/${query({
          from: period.from,
          to: period.to,
          search: debounced,
          org_unit: orgUnits.join(","),
        })}`,
  )

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Late arrivals, early leaves and full-day absences — one bar per day. Hover a bar for the detail, or use the search icon on a row to record one."
      />

      <ListToolbar>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="range"
            className="whitespace-nowrap text-sm font-normal text-muted-foreground"
          >
            Show
          </Label>
          <Select value={range} onValueChange={(value) => setRange(value as Range)}>
            <SelectTrigger id="range" className="w-32" aria-label="Time frame">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {range === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker
              value={customFrom}
              onChange={setCustomFrom}
              label="From"
              className="w-40"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <DatePicker
              value={customTo}
              onChange={setCustomTo}
              label="To"
              className="w-40"
            />
          </div>
        )}

        <SearchInput
          value={search}
          onChange={setSearch}
          label="Search people"
          placeholder="Search by name or code…"
        />
        <FilterMenu
          label="Org unit"
          allLabel="All org units"
          options={(units.data?.results ?? []).map((unit) => ({
            value: unit.id,
            label: `${unit.code} — ${unit.name}`,
          }))}
          values={orgUnits}
          onChange={setOrgUnits}
        />
      </ListToolbar>

      {problem ? (
        <Card className="p-8 text-center">
          <p role="alert" className="text-sm font-medium text-destructive">
            {problem}
          </p>
        </Card>
      ) : (
        <>
          {data && (
            <p className="mb-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {pretty(data.from)} – {pretty(data.to)}
              </span>{" "}
              · {data.totals.late} late{" "}
              {data.totals.late === 1 ? "arrival" : "arrivals"} · {data.totals.early}{" "}
              early {data.totals.early === 1 ? "leave" : "leaves"} ·{" "}
              {data.totals.absent} full-day{" "}
              {data.totals.absent === 1 ? "absence" : "absences"} ·{" "}
              {data.totals.unexcused} unexcused
            </p>
          )}

          <Card className="overflow-hidden py-0">
            {isLoading ? (
              <LoadingRows />
            ) : error ? (
              <ErrorState message={error} />
            ) : !data || data.people.length === 0 ? (
              <EmptyState
                message="Nobody matches."
                hint="Clear the search and org unit filter, or widen the time frame."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead className="w-16 text-right">Late</TableHead>
                      <TableHead className="w-16 text-right">Early</TableHead>
                      <TableHead className="w-16 text-right">Absent</TableHead>
                      <TableHead className="w-[300px]">
                        {data.dates.length} {data.dates.length === 1 ? "day" : "days"}
                      </TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.people.map((person) => (
                      <TableRow key={person.employment}>
                        <TableCell>
                          <div className="font-medium">{person.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {person.org_unit_name ?? "Unassigned"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.late_count || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.early_count || "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.absent_count || "—"}
                        </TableCell>
                        <TableCell>
                          <DayStrip days={person.days} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Edit attendance for ${person.name}`}
                            onClick={() => setEditing(person)}
                          >
                            <Search className="size-4" strokeWidth={3} aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>

          <div className="mt-3">
            <StripLegend />
          </div>
        </>
      )}

      <AttendanceDialog
        person={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={reload}
      />
    </>
  )
}
