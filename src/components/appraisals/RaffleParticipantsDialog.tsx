import { Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { SelectField } from "@/components/form/Field"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError, api, query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { Employment, Raffle, RaffleEntry } from "@/lib/types"
import { useApi } from "@/lib/useApi"

/**
 * Who is in one raffle, and how many tickets each of them holds.
 *
 * Participants differ from draw to draw, so this is a live editor rather than
 * a form with a single submit: every change is written as it is made, and the
 * list reloads from the server rather than being patched locally, so the totals
 * on screen are the server's numbers and not a guess.
 */
export default function RaffleParticipantsDialog({
  raffle,
  onOpenChange,
  onSaved,
}: {
  raffle: Raffle | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const entries = useApi<Paginated<RaffleEntry>>(
    raffle
      ? `/raffle-entries/${query({ raffle: raffle.id, page_size: 200, ordering: "person_name" })}`
      : null,
  )
  const employments = useApi<Paginated<Employment>>(
    raffle ? `/employments/${query({ page_size: 200, ordering: "employee_code" })}` : null,
  )

  const [addWho, setAddWho] = useState("")
  const [addTickets, setAddTickets] = useState("1")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)

  // Local text for the ticket boxes. Typing must not fight the server, so the
  // input holds a draft and only a commit sends it.
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (raffle) {
      setAddWho("")
      setAddTickets("1")
      setErrors({})
      setDrafts({})
    }
  }, [raffle])

  const rows = entries.data?.results ?? []
  const totalTickets = rows.reduce((sum, row) => sum + row.tickets, 0)

  const refresh = () => {
    entries.reload()
    // The list behind the dialog shows participant and ticket counts, so it
    // has to be told too.
    onSaved()
  }

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setErrors({})
    try {
      await action()
      refresh()
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors)
      else if (error instanceof Error) setErrors({ detail: [error.message] })
    } finally {
      setBusy(false)
    }
  }

  const add = () =>
    run(async () => {
      await api.post("/raffle-entries/", {
        raffle: raffle!.id,
        employment: addWho,
        tickets: Number(addTickets) || 1,
      })
      setAddWho("")
      setAddTickets("1")
    })

  const commitTickets = (entry: RaffleEntry) => {
    const draft = drafts[entry.id]
    if (draft === undefined) return
    const next = Number(draft)
    setDrafts((current) => {
      const rest = { ...current }
      delete rest[entry.id]
      return rest
    })
    // Nothing to write when the number did not actually move.
    if (!Number.isFinite(next) || next === entry.tickets) return
    void run(() => api.patch(`/raffle-entries/${entry.id}/`, { tickets: next }))
  }

  // Somebody already holding tickets is not offered again; the server refuses
  // a duplicate anyway, but there is no reason to show the option.
  const taken = new Set(rows.map((row) => row.employment))
  const candidates = (employments.data?.results ?? [])
    .filter((row) => row.status !== "TERMINATED" && !taken.has(row.id))
    .map((row) => ({
      value: row.id,
      label: `${row.employee_code} — ${row.person_detail.display_name}`,
    }))

  return (
    <Dialog open={raffle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{raffle?.name ?? "Raffle"}</DialogTitle>
          <DialogDescription>
            {rows.length} {rows.length === 1 ? "participant" : "participants"} ·{" "}
            {totalTickets} {totalTickets === 1 ? "ticket" : "tickets"} in the draw
          </DialogDescription>
        </DialogHeader>

        {errors.detail && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errors.detail[0]}
          </p>
        )}

        <div className="rounded-md border">
          <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Participants
          </p>

          {entries.isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nobody is in this raffle yet.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{entry.person_name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {entry.employee_code} · {entry.org_unit_name ?? "Unassigned"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`tickets-${entry.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Tickets
                    </Label>
                    <Input
                      id={`tickets-${entry.id}`}
                      type="number"
                      min={1}
                      className="h-8 w-20 tabular-nums"
                      value={drafts[entry.id] ?? String(entry.tickets)}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [entry.id]: event.target.value,
                        }))
                      }
                      onBlur={() => commitTickets(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          event.currentTarget.blur()
                        }
                      }}
                    />
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                      {totalTickets > 0
                        ? `${Math.round((entry.tickets / totalTickets) * 100)}%`
                        : "—"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busy}
                      aria-label={`Remove ${entry.person_name}`}
                      onClick={() =>
                        void run(() => api.delete(`/raffle-entries/${entry.id}/`))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <SelectField
            name="employment"
            label="Add a participant"
            errors={errors}
            value={addWho}
            onChange={setAddWho}
            options={candidates}
            placeholder={candidates.length === 0 ? "Everyone is in" : "Select…"}
          />
          <div className="grid gap-2">
            <Label htmlFor="add-tickets">Tickets</Label>
            <Input
              id="add-tickets"
              type="number"
              min={1}
              className="w-24 tabular-nums"
              value={addTickets}
              onChange={(event) => setAddTickets(event.target.value)}
            />
          </div>
          <Button onClick={add} disabled={!addWho || busy}>
            <Plus className="size-4" aria-hidden />
            Add
          </Button>
          {errors.tickets && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {errors.tickets[0]}
            </p>
          )}
          {errors.employment && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {errors.employment[0]}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
