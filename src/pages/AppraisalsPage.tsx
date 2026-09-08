import { Gift, Plus, Ticket } from "lucide-react"
import { useEffect, useState } from "react"

import RaffleParticipantsDialog from "@/components/appraisals/RaffleParticipantsDialog"
import TenureDialog from "@/components/appraisals/TenureDialog"
import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, TextAreaField, TextField, enumOptions } from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import FilterMenu from "@/components/list/FilterMenu"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Paginated } from "@/lib/api"
import type { Raffle, TenureStanding } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const BONUS_STATUSES = ["DUE", "UP_TO_DATE"] as const

/** "1 y 3 m" — long service reads badly as a raw month count. */
function service(months: number): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  if (years === 0) return `${rest} m`
  if (rest === 0) return `${years} y`
  return `${years} y ${rest} m`
}

type View = "tenure" | "raffles"

export default function AppraisalsPage() {
  const [view, setView] = useState<View>("tenure")

  return (
    <>
      <PageHeader
        title="Appraisals"
        description="What the company gives back: the six-month tenure bonus, and one-off prize draws."
      />

      <div
        role="tablist"
        aria-label="Appraisal type"
        className="mb-4 inline-flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        <ViewTab current={view} value="tenure" icon={Gift} onSelect={setView}>
          Tenure bonuses
        </ViewTab>
        <ViewTab current={view} value="raffles" icon={Ticket} onSelect={setView}>
          Raffles
        </ViewTab>
      </div>

      {view === "tenure" ? <TenureView /> : <RafflesView />}
    </>
  )
}

function ViewTab({
  current,
  value,
  icon: Icon,
  onSelect,
  children,
}: {
  current: View
  value: View
  icon: typeof Gift
  onSelect: (value: View) => void
  children: React.ReactNode
}) {
  const active = current === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(value)}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tenure bonuses
// ---------------------------------------------------------------------------

function TenureView() {
  const params = useListParams({
    ordering: "next_due",
    filters: { bonus_status: [] },
  })
  const { data, error, isLoading, reload } = useApi<Paginated<TenureStanding>>(
    `/tenure/${params.queryString}`,
  )

  // The dialog is keyed by employment rather than by row, so it re-reads the
  // reloaded list after a save instead of showing a stale copy.
  const [target, setTarget] = useState<string | null>(null)
  const standing = data?.results.find((row) => row.employment === target) ?? null

  return (
    <>
      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search people"
          placeholder="Search by name or code…"
        />
        <FilterMenu
          label="Bonus"
          allLabel="All"
          values={params.filters.bonus_status}
          onChange={(values) => params.setFilter("bonus_status", values)}
          options={enumOptions(BONUS_STATUSES)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState message="Nobody matches." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="name" {...params.sort}>Person</SortableHead>
                <SortableHead field="hire_date" {...params.sort}>Joined</SortableHead>
                <SortableHead field="months_of_service" {...params.sort}>
                  Service
                </SortableHead>
                <SortableHead field="milestones_reached" {...params.sort} className="text-right">
                  Reached
                </SortableHead>
                <SortableHead field="milestones_paid" {...params.sort} className="text-right">
                  Paid
                </SortableHead>
                <SortableHead field="next_due" {...params.sort}>Next due</SortableHead>
                <SortableHead field="bonus_status" {...params.sort}>Status</SortableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.map((row) => (
                <TableRow key={row.employment}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.employee_code} · {row.org_unit_name ?? "Unassigned"}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.hire_date}</TableCell>
                  <TableCell className="tabular-nums">
                    {service(row.months_of_service)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.milestones_reached}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.milestones_paid}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.next_due}</TableCell>
                  <TableCell>
                    {row.outstanding > 0 ? (
                      <Badge variant="outline" className="font-normal text-destructive">
                        {row.outstanding} due
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Up to date
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Bonuses for ${row.name}`}
                      onClick={() => setTarget(row.employment)}
                    >
                      <Gift className="size-4" strokeWidth={3} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pagination
        page={params.page}
        pageSize={params.pageSize}
        count={data?.count ?? 0}
        noun="person"
        plural="people"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <TenureDialog
        standing={standing}
        onOpenChange={(open) => !open && setTarget(null)}
        onSaved={reload}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Raffles
// ---------------------------------------------------------------------------

const EMPTY_RAFFLE = { name: "", date: "", description: "" }

function RafflesView() {
  const params = useListParams({ ordering: "-date" })
  const { data, error, isLoading, reload } = useApi<Paginated<Raffle>>(
    `/raffles/${params.queryString}`,
  )
  const crud = useCrud<Raffle>("/raffles", reload)
  const [form, setForm] = useState(EMPTY_RAFFLE)
  const [participantsOf, setParticipantsOf] = useState<string | null>(null)
  const raffle = data?.results.find((row) => row.id === participantsOf) ?? null

  useEffect(() => {
    if (crud.editing) {
      const row = crud.editing
      setForm({ name: row.name, date: row.date, description: row.description })
    } else if (crud.isCreating) {
      setForm(EMPTY_RAFFLE)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={crud.openCreate}>
          <Plus className="size-4" aria-hidden />
          New raffle
        </Button>
      </div>

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search raffles"
          placeholder="Search by name or rules…"
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No raffles yet."
            hint="Create one, then add participants and their tickets."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="name" {...params.sort}>Raffle</SortableHead>
                <SortableHead field="date" {...params.sort}>Date</SortableHead>
                <SortableHead field="participant_count" {...params.sort} className="text-right">
                  Participants
                </SortableHead>
                <SortableHead field="total_tickets" {...params.sort} className="text-right">
                  Tickets
                </SortableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.results.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="max-w-xl truncate text-xs text-muted-foreground">
                      {row.description || "No rules recorded."}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.date}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.participant_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.total_tickets}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Participants in ${row.name}`}
                        onClick={() => setParticipantsOf(row.id)}
                      >
                        <Ticket className="size-4" strokeWidth={3} aria-hidden />
                      </Button>
                      <RowActions
                        actions={[
                          {
                            label: "Participants",
                            onSelect: () => setParticipantsOf(row.id),
                          },
                          { label: "Edit", onSelect: () => crud.openEdit(row) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(row),
                          },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Pagination
        page={params.page}
        pageSize={params.pageSize}
        count={data?.count ?? 0}
        noun="raffle"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="raffle"
        labelOf={(row) => row.name}
        description="Deleting a raffle removes its participants with it."
        buildBody={() => form}
      >
        {(errors) => (
          <>
            <FieldRow>
              <TextField
                name="name"
                label="Name"
                required
                errors={errors}
                value={form.name}
                onChange={(name) => setForm((f) => ({ ...f, name }))}
              />
              <TextField
                name="date"
                label="Draw date"
                type="date"
                required
                errors={errors}
                value={form.date}
                onChange={(date) => setForm((f) => ({ ...f, date }))}
              />
            </FieldRow>
            <TextAreaField
              name="description"
              label="Description and rules"
              hint="How tickets are earned, what the prize is."
              errors={errors}
              value={form.description}
              onChange={(description) => setForm((f) => ({ ...f, description }))}
            />
          </>
        )}
      </CrudDialogs>

      <RaffleParticipantsDialog
        raffle={raffle}
        onOpenChange={(open) => !open && setParticipantsOf(null)}
        onSaved={reload}
      />
    </>
  )
}
