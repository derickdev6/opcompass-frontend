import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AttendanceDay, AttendanceIncident } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * One bar per day, coloured by the worst thing that happened.
 *
 * The colour is the whole point of the strip: a month of somebody's attendance
 * has to be readable at a glance, before anyone hovers anything. Hover is for
 * the detail, never for the headline.
 */
const TONE: Record<AttendanceDay["status"], string> = {
  CLEAN: "bg-emerald-500",
  JUSTIFIED: "bg-sky-500",
  EXCUSED: "bg-amber-500",
  UNEXCUSED: "bg-rose-500",
  // Neither counts for nor against: a weekend, or a date outside the
  // employment altogether.
  OFF: "bg-muted-foreground/20",
  NONE: "bg-muted-foreground/10",
  // A day still to come: the same shape, drawn as an outline rather than
  // filled, so a week in progress reads as partly unwritten.
  FUTURE: "border border-muted-foreground/30 bg-transparent",
}

/**
 * A whole day missed is drawn as half a pill — same width, half the height.
 *
 * Justification already owns the hue — that is the question the three statuses
 * answer — so severity has to be carried by shape instead, or "absent all day,
 * unexcused" would look identical to "ten minutes late, unexcused". Height
 * reads as "how much of the day was worked"; narrowing it would not.
 */
const FULL_BAR = "h-7"
const HALF_BAR = "h-3.5"

export const STATUS_LABEL: Record<AttendanceDay["status"], string> = {
  CLEAN: "On time",
  JUSTIFIED: "Justified",
  EXCUSED: "Excused",
  UNEXCUSED: "Unexcused",
  OFF: "Non-working day",
  NONE: "Outside this employment",
  FUTURE: "Still to come",
}

export const BUCKET_LABEL: Record<AttendanceBucketKey, string> = {
  M15: "up to 15 min",
  M30: "up to 30 min",
  H1: "up to 1 h",
  H2: "up to 2 h",
  H3: "up to 3 h",
  H4: "over 3 h",
}

type AttendanceBucketKey = NonNullable<AttendanceIncident["bucket"]>

const TYPE_LABEL: Record<AttendanceIncident["type"], string> = {
  LATE_ARRIVAL: "Late arrival",
  EARLY_LEAVE: "Early leave",
  ABSENCE: "Absent",
}

const JUSTIFICATION_LABEL: Record<AttendanceIncident["justification"], string> = {
  UNEXCUSED: "Unexcused",
  EXCUSED: "Excused",
  JUSTIFIED: "Justified",
}

/** "Non-working day", or the holiday's own name when it has one. */
function restLabel(day: AttendanceDay): string {
  return day.holiday ?? STATUS_LABEL[day.status]
}

/** A worked weekend or holiday is worth calling out; a worked Tuesday is not. */
function workedNote(day: AttendanceDay): string | null {
  if (day.incidents.length === 0) return null
  if (day.holiday) return `Worked — ${day.holiday}`
  const weekday = new Date(`${day.date}T00:00:00`).getDay()
  return weekday === 0 || weekday === 6 ? "Worked — weekend" : null
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

/** "47 min (up to 1 h)", or "the whole day" when nothing was worked. */
function extent(incident: AttendanceIncident): string {
  if (incident.minutes === null || incident.bucket === null) return "the whole day"
  return `${incident.minutes} min (${BUCKET_LABEL[incident.bucket]})`
}

export default function DayStrip({ days }: { days: AttendanceDay[] }) {
  return (
    <div className="flex items-center gap-[3px]">
      {days.map((day) => (
        <Tooltip key={day.date}>
          <TooltipTrigger asChild>
            <button
              type="button"
              // A bar is a real control so it is reachable by keyboard; the
              // tooltip is the only way to read a day's detail. The button keeps
              // its full height whatever the bar inside does, so a half pill is
              // no harder to hit or to focus.
              aria-label={`${longDate(day.date)}: ${
                day.absent ? "Absent all day, " : ""
              }${restLabel(day)}`}
              className="flex h-7 w-[7px] shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "w-full rounded-full",
                  TONE[day.status],
                  day.absent ? HALF_BAR : FULL_BAR,
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-64">
            <p className="font-medium">{longDate(day.date)}</p>
            {workedNote(day) && (
              <p className="text-xs opacity-70">{workedNote(day)}</p>
            )}
            {day.incidents.length === 0 ? (
              <p className="mt-0.5 opacity-80">{restLabel(day)}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {day.incidents.map((incident) => (
                  <li key={incident.id}>
                    <span className="font-medium">{TYPE_LABEL[incident.type]}</span> —{" "}
                    {extent(incident)}
                    <br />
                    <span className="opacity-80">
                      {JUSTIFICATION_LABEL[incident.justification]}
                      {incident.reason ? ` · ${incident.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

/** The key under the table. Colour alone never has to carry the meaning. */
export function StripLegend() {
  const statuses: AttendanceDay["status"][] = [
    "CLEAN",
    "JUSTIFIED",
    "EXCUSED",
    "UNEXCUSED",
    "OFF",
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {statuses.map((status) => (
        <span
          key={status}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span className={cn("h-3 w-[7px] rounded-full", TONE[status])} aria-hidden />
          {STATUS_LABEL[status]}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {/* Boxed to the same 3-unit height as the others so the half sits
            level with them rather than floating. */}
        <span className="flex h-3 w-[7px] items-center justify-center" aria-hidden>
          <span className={cn("h-1.5 w-full rounded-full", TONE.UNEXCUSED)} />
        </span>
        Absent all day (half bar)
      </span>
    </div>
  )
}
