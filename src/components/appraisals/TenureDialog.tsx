import { useEffect, useState } from "react"

import { TextField } from "@/components/form/Field"
import type { FieldErrors } from "@/components/form/FormDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError, api } from "@/lib/api"
import type { TenureMilestone, TenureStanding } from "@/lib/types"

/** Today as YYYY-MM-DD in local time, which is the day the user means. */
function todayValue(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

/**
 * Milestones alternate between whole years and half ones, so a plain month
 * count would read as "78 months" directly under "7 years". Years win once
 * there is a year to name.
 */
function milestoneLabel(milestone: number): string {
  const months = milestone * 6
  if (months < 12) return `${months} months`
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (rest === 0) return years === 1 ? "1 year" : `${years} years`
  return `${years} y ${rest} m`
}

/**
 * One person's six-month bonuses.
 *
 * The schedule is read-only — it comes from the hire date and nothing here can
 * move it. What can be edited is whether a milestone has been paid, which is
 * the only part that is actually stored.
 */
export default function TenureDialog({
  standing,
  onOpenChange,
  onSaved,
}: {
  standing: TenureStanding | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [recording, setRecording] = useState<number | null>(null)
  const [form, setForm] = useState({ paid_on: todayValue(), amount: "", note: "" })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRecording(null)
    setErrors({})
  }, [standing?.employment])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setErrors({})
    try {
      await action()
      setRecording(null)
      onSaved()
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors)
      else if (error instanceof Error) setErrors({ detail: [error.message] })
    } finally {
      setBusy(false)
    }
  }

  const openRecord = (milestone: TenureMilestone) => {
    setErrors({})
    setRecording(milestone.milestone)
    // Defaults that are right most of the time: paid today, for the amount the
    // milestone is worth if a previous one recorded a figure.
    setForm({ paid_on: todayValue(), amount: "", note: "" })
  }

  const save = (milestone: TenureMilestone) =>
    run(() =>
      api.post("/tenure-bonuses/", {
        employment: standing!.employment,
        milestone: milestone.milestone,
        paid_on: form.paid_on,
        amount: form.amount || null,
        note: form.note,
      }),
    )

  // Newest first: the milestone somebody is chasing is the most recent one, not
  // the one from four years ago.
  const milestones = [...(standing?.milestones ?? [])].reverse()

  return (
    <Dialog open={standing !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{standing?.name ?? "Tenure"}</DialogTitle>
          <DialogDescription>
            {standing?.employee_code} · joined {standing?.hire_date} ·{" "}
            {standing?.milestones_paid ?? 0} of {standing?.milestones_reached ?? 0} paid
          </DialogDescription>
        </DialogHeader>

        {errors.detail && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errors.detail[0]}
          </p>
        )}

        <ul className="divide-y rounded-md border">
          {milestones.map((milestone) => (
            <li key={milestone.milestone} className="px-3 py-2 text-sm">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {milestoneLabel(milestone.milestone)}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · due {milestone.due_date}
                    </span>
                  </div>
                  {milestone.paid && (
                    <div className="truncate text-xs text-muted-foreground">
                      Paid {milestone.paid_on}
                      {milestone.amount ? ` · ${milestone.amount}` : ""}
                      {milestone.note ? ` · ${milestone.note}` : ""}
                    </div>
                  )}
                </div>

                {milestone.paid ? (
                  <>
                    <Badge variant="outline" className="font-normal">
                      Paid
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          api.delete(`/tenure-bonuses/${milestone.bonus_id}/`),
                        )
                      }
                    >
                      Undo
                    </Button>
                  </>
                ) : milestone.reached ? (
                  <>
                    <Badge variant="outline" className="font-normal text-destructive">
                      Due
                    </Badge>
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => openRecord(milestone)}
                    >
                      Record
                    </Button>
                  </>
                ) : (
                  <Badge variant="outline" className="font-normal text-muted-foreground">
                    Upcoming
                  </Badge>
                )}
              </div>

              {recording === milestone.milestone && (
                <div className="mt-3 grid gap-3 rounded-md border bg-muted/40 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      name="paid_on"
                      label="Paid on"
                      type="date"
                      required
                      errors={errors}
                      value={form.paid_on}
                      onChange={(paid_on) => setForm((f) => ({ ...f, paid_on }))}
                    />
                    <TextField
                      name="amount"
                      label="Amount"
                      type="number"
                      hint="Optional — leave blank if it was not cash."
                      errors={errors}
                      value={form.amount}
                      onChange={(amount) => setForm((f) => ({ ...f, amount }))}
                    />
                  </div>
                  <TextField
                    name="note"
                    label="Note"
                    errors={errors}
                    value={form.note}
                    onChange={(note) => setForm((f) => ({ ...f, note }))}
                  />
                  {errors.milestone && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.milestone[0]}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecording(null)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void save(milestone)}>
                      Save bonus
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
