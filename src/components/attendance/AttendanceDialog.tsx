import { Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import DatePicker, { toValue } from "@/components/attendance/DatePicker"
import { SelectField, TextField, enumOptions } from "@/components/form/Field"
import type { FieldErrors } from "@/components/form/FormDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api, query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { AttendanceIncident, AttendanceRow } from "@/lib/types"
import { useApi } from "@/lib/useApi"

const TYPES = ["LATE_ARRIVAL", "EARLY_LEAVE", "ABSENCE"] as const
const JUSTIFICATIONS = ["UNEXCUSED", "EXCUSED", "JUSTIFIED"] as const

const TYPE_LABEL: Record<string, string> = {
  LATE_ARRIVAL: "Late arrival",
  EARLY_LEAVE: "Early leave",
  ABSENCE: "Absent all day",
}

/**
 * The six brackets the business reports on, each mapped to a representative
 * figure.
 *
 * The bracket is what people think in; the record stores real minutes so the
 * brackets can be redrawn later without a migration. Picking one fills the
 * minutes field, which stays editable for when the exact number is known.
 */
const DURATIONS = [
  { value: "10", label: "Up to 15 min" },
  { value: "25", label: "16 – 30 min" },
  { value: "45", label: "31 – 60 min" },
  { value: "90", label: "1 – 2 h" },
  { value: "150", label: "2 – 3 h" },
  { value: "240", label: "Over 3 h" },
]

/** Which bracket a minutes figure falls in, for showing the select's value. */
function bracketOf(minutes: string): string {
  const value = Number(minutes)
  if (!Number.isFinite(value) || value <= 0) return ""
  if (value <= 15) return "10"
  if (value <= 30) return "25"
  if (value <= 60) return "45"
  if (value <= 120) return "90"
  if (value <= 180) return "150"
  return "240"
}

const EMPTY = {
  type: "LATE_ARRIVAL",
  minutes: "10",
  justification: "UNEXCUSED",
  reason: "",
}

export default function AttendanceDialog({
  person,
  onOpenChange,
  onSaved,
}: {
  /** Null closes the dialog. */
  person: AttendanceRow | null
  onOpenChange: (open: boolean) => void
  /** Called after any write, so the strip behind the dialog catches up. */
  onSaved: () => void
}) {
  const [date, setDate] = useState(toValue(new Date()))
  const [editing, setEditing] = useState<AttendanceIncident | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const records = useApi<Paginated<AttendanceIncident>>(
    person
      ? `/attendance-records/${query({
          employment: person.employment,
          date,
          page_size: 20,
        })}`
      : null,
  )

  // A new person, or a new day, is a fresh sheet.
  useEffect(() => {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setBanner(null)
  }, [person?.employment, date])

  const reset = () => {
    setEditing(null)
    setForm(EMPTY)
    setErrors({})
    setBanner(null)
  }

  const fail = (caught: unknown) => {
    if (caught instanceof ApiError) {
      setErrors(caught.errors ?? {})
      if (!caught.errors || Object.keys(caught.errors).length === 0) {
        setBanner(caught.message)
      }
    } else {
      setBanner("Could not reach the server. Try again in a moment.")
    }
  }

  const save = async () => {
    if (!person) return
    setErrors({})
    setBanner(null)
    setBusy(true)
    try {
      const body = {
        employment: person.employment,
        date,
        type: form.type,
        justification: form.justification,
        reason: form.reason,
        minutes: form.type === "ABSENCE" ? null : Number(form.minutes),
      }
      if (editing) await api.patch(`/attendance-records/${editing.id}/`, body)
      else await api.post("/attendance-records/", body)
      reset()
      records.reload()
      onSaved()
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (incident: AttendanceIncident) => {
    setErrors({})
    setBanner(null)
    setBusy(true)
    try {
      await api.delete(`/attendance-records/${incident.id}/`)
      if (editing?.id === incident.id) reset()
      records.reload()
      onSaved()
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  const edit = (incident: AttendanceIncident) => {
    setEditing(incident)
    setErrors({})
    setBanner(null)
    setForm({
      type: incident.type,
      minutes: String(incident.minutes ?? ""),
      justification: incident.justification,
      reason: incident.reason,
    })
  }

  const saved = records.data?.results ?? []
  const isAbsence = form.type === "ABSENCE"

  return (
    <Dialog open={person !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{person?.name ?? "Attendance"}</DialogTitle>
          <DialogDescription>
            {person?.org_unit_name ?? "Unassigned"} · {person?.employee_code}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="attendance-date">Day</Label>
          <DatePicker
            value={date}
            onChange={setDate}
            label="Day to record"
            // Nothing can be logged before someone joined or after they left,
            // and the future has not happened yet.
            disabled={(candidate) => candidate > new Date()}
            className="w-full sm:w-56"
          />
        </div>

        {/* What is already on file for that day. */}
        <div className="rounded-md border">
          <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recorded this day
          </p>
          {records.isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : saved.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nothing recorded — the day counts as worked on time.
            </p>
          ) : (
            <ul className="divide-y">
              {saved.map((incident) => (
                <li
                  key={incident.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {TYPE_LABEL[incident.type] ?? incident.type}
                      {incident.minutes !== null && (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {incident.minutes} min
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {incident.justification.toLowerCase()}
                      {incident.reason ? ` · ${incident.reason}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Edit ${TYPE_LABEL[incident.type]}`}
                    disabled={busy}
                    onClick={() => edit(incident)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={`Remove ${TYPE_LABEL[incident.type]}`}
                    disabled={busy}
                    onClick={() => void remove(incident)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add, or edit the one picked above. */}
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {editing ? `Edit ${TYPE_LABEL[editing.type]?.toLowerCase()}` : "Add a record"}
          </p>

          {banner && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {banner}
            </p>
          )}

          <SelectField
            name="type"
            label="What happened"
            required
            errors={errors}
            value={form.type}
            onChange={(type) => setForm((f) => ({ ...f, type }))}
            options={TYPES.map((value) => ({ value, label: TYPE_LABEL[value]! }))}
          />

          {!isAbsence && (
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="bracket"
                label="How long"
                hint="Sets the minutes below; adjust it if you know the exact figure."
                errors={errors}
                value={bracketOf(form.minutes)}
                onChange={(minutes) => setForm((f) => ({ ...f, minutes }))}
                options={DURATIONS}
              />
              <TextField
                name="minutes"
                label="Minutes"
                type="number"
                required
                errors={errors}
                value={form.minutes}
                onChange={(minutes) => setForm((f) => ({ ...f, minutes }))}
              />
            </div>
          )}

          <SelectField
            name="justification"
            label="Justification"
            required
            errors={errors}
            value={form.justification}
            onChange={(justification) => setForm((f) => ({ ...f, justification }))}
            options={enumOptions(JUSTIFICATIONS)}
          />

          <TextField
            name="reason"
            label="Reason"
            hint="Shown on the day's tooltip."
            errors={errors}
            value={form.reason}
            onChange={(reason) => setForm((f) => ({ ...f, reason }))}
          />

          <DialogFooter className="mt-1">
            {editing && (
              <Button type="button" variant="outline" onClick={reset} disabled={busy}>
                Cancel edit
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {editing ? (
                busy ? (
                  "Saving…"
                ) : (
                  "Save changes"
                )
              ) : (
                <>
                  <Plus className="size-4" aria-hidden />
                  {busy ? "Adding…" : "Add record"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
