import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, SelectField, TextField, enumOptions } from "@/components/form/Field"
import FormDialog from "@/components/form/FormDialog"
import RowActions from "@/components/form/RowActions"
import FilterSelect from "@/components/list/FilterSelect"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import StatusBadge from "@/components/StatusBadge"
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
import { api, query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { Employment, LegalEntity, Person, Position } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { ALL, useListParams } from "@/lib/useListParams"

const TYPES = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN", "TEMP"] as const
const MODES = ["ONSITE", "REMOTE", "HYBRID"] as const
const STATUSES = [
  "PREBOARDING",
  "ONBOARDING",
  "PROBATION",
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "OFFBOARDING",
  "TERMINATED",
] as const
const REASONS = [
  "HIRE",
  "PROMOTION",
  "LATERAL",
  "REORG",
  "DEMOTION",
  "INTERIM",
] as const

const EMPTY = {
  person: "",
  legal_entity: "",
  employee_code: "",
  employment_type: "FULL_TIME",
  work_mode: "ONSITE",
  hire_date: "",
  probation_end_date: "",
  work_email: "",
  timezone: "UTC",
}

const today = () => new Date().toISOString().slice(0, 10)

export default function EmploymentsPage() {
  const params = useListParams({
    ordering: "-hire_date",
    filters: { status: ALL, employment_type: ALL },
  })
  const { data, error, isLoading, reload } = useApi<Paginated<Employment>>(
    `/employments/${params.queryString}`,
  )
  const people = useApi<Paginated<Person>>(`/people/${query({ page_size: 200 })}`)
  const entities = useApi<Paginated<LegalEntity>>(
    `/legal-entities/${query({ page_size: 200 })}`,
  )
  const positions = useApi<Paginated<Position>>(`/positions/${query({ page_size: 200 })}`)

  // "Reports to" must offer everyone, not the ten employments on the current
  // page — the table's pagination cannot decide who can be a manager.
  const allEmployments = useApi<Paginated<Employment>>(
    `/employments/${query({ page_size: 200, ordering: "employee_code" })}`,
  )

  const crud = useCrud<Employment>("/employments", () => {
    reload()
    allEmployments.reload()
  })
  const [form, setForm] = useState(EMPTY)

  // Assignment and lifecycle each get their own dialog: neither is an edit of
  // the employment row, and both have their own server-side rules.
  const [assigning, setAssigning] = useState<Employment | null>(null)
  const [assignForm, setAssignForm] = useState({
    position: "",
    manager_employment: "",
    effective_from: today(),
    change_reason: "HIRE",
  })

  const [transitioning, setTransitioning] = useState<Employment | null>(null)
  const [transitionForm, setTransitionForm] = useState({
    to_status: "",
    effective_from: today(),
    reason: "",
  })

  useEffect(() => {
    if (crud.editing) {
      const e = crud.editing
      setForm({
        person: e.person,
        legal_entity: e.legal_entity,
        employee_code: e.employee_code,
        employment_type: e.employment_type,
        work_mode: e.work_mode,
        hire_date: e.hire_date,
        probation_end_date: e.probation_end_date ?? "",
        work_email: e.work_email,
        timezone: e.timezone,
      })
    } else if (crud.isCreating) {
      setForm({ ...EMPTY, hire_date: today() })
    }
  }, [crud.editing, crud.isCreating])

  useEffect(() => {
    if (assigning) {
      setAssignForm({
        position: "",
        manager_employment: "",
        effective_from: today(),
        change_reason: "HIRE",
      })
    }
  }, [assigning])

  useEffect(() => {
    if (transitioning) {
      setTransitionForm({
        to_status: transitioning.allowed_transitions[0] ?? "",
        effective_from: today(),
        reason: "",
      })
    }
  }, [transitioning])

  const employmentOptions = (allEmployments.data?.results ?? [])
    .filter((e) => e.id !== assigning?.id) // cannot report to yourself
    .map((e) => ({
      value: e.id,
      label: `${e.employee_code} — ${e.person_detail.display_name}`,
    }))

  return (
    <>
      <PageHeader
        title="Employments"
        description="Each contractual relationship. A rehire is a new employment against the same person."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New employment
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search employments"
          placeholder="Search by code, name or work email…"
        />
        <FilterSelect
          label="Status"
          allLabel="All statuses"
          value={params.filters.status}
          onChange={(value) => params.setFilter("status", value)}
          options={enumOptions(STATUSES)}
        />
        <FilterSelect
          label="Type"
          allLabel="All types"
          value={params.filters.employment_type}
          onChange={(value) => params.setFilter("employment_type", value)}
          options={enumOptions(TYPES)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No employments match."
            hint="Create a person and a legal entity first."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="person_detail.display_name" {...params.sort}>
                    Person
                  </SortableHead>
                  <SortableHead field="hire_date" {...params.sort}>Hired</SortableHead>
                  <SortableHead field="current_position.job_title" {...params.sort}>
                    Position
                  </SortableHead>
                  <SortableHead field="manager.name" {...params.sort}>Manager</SortableHead>
                  <SortableHead field="status" {...params.sort}>Status</SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((employment) => (
                  <TableRow key={employment.id}>
                    <TableCell>
                      <div className="font-medium">
                        {employment.person_detail.display_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {employment.work_email || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {employment.hire_date}
                    </TableCell>
                    <TableCell>
                      {employment.current_position ? (
                        <>
                          <div>{employment.current_position.job_title}</div>
                          <div className="text-xs text-muted-foreground">
                            {employment.current_position.org_unit}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{employment.manager?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={employment.status} />
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(employment) },
                          {
                            label: employment.current_position
                              ? "Reassign position"
                              : "Assign position",
                            onSelect: () => setAssigning(employment),
                          },
                          ...(employment.allowed_transitions.length
                            ? [
                                {
                                  label: "Change status",
                                  onSelect: () => setTransitioning(employment),
                                },
                              ]
                            : []),
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(employment),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Pagination
        page={params.page}
        pageSize={params.pageSize}
        count={data?.count ?? 0}
        noun="employment"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      {/* Create / edit / delete */}
      <CrudDialogs
        crud={crud}
        noun="employment"
        labelOf={(e) => `${e.employee_code} — ${e.person_detail.display_name}`}
        description="New employments start in Preboarding. Use Change status to move them along."
        buildBody={() => ({
          ...form,
          probation_end_date: form.probation_end_date || null,
        })}
      >
        {(errors) => (
          <>
            <SelectField
              name="person"
              label="Person"
              required
              errors={errors}
              value={form.person}
              onChange={(person) => setForm((f) => ({ ...f, person }))}
              options={(people.data?.results ?? []).map((p) => ({
                value: p.id,
                label: p.display_name,
              }))}
            />
            <FieldRow>
              <SelectField
                name="legal_entity"
                label="Legal entity"
                required
                errors={errors}
                value={form.legal_entity}
                onChange={(legal_entity) => setForm((f) => ({ ...f, legal_entity }))}
                options={(entities.data?.results ?? []).map((e) => ({
                  value: e.id,
                  label: e.name,
                }))}
              />
              <TextField
                name="employee_code"
                label="Employee code"
                required
                hint="Unique across the company."
                errors={errors}
                value={form.employee_code}
                onChange={(employee_code) => setForm((f) => ({ ...f, employee_code }))}
              />
            </FieldRow>
            <FieldRow>
              <SelectField
                name="employment_type"
                label="Employment type"
                errors={errors}
                value={form.employment_type}
                onChange={(employment_type) => setForm((f) => ({ ...f, employment_type }))}
                options={enumOptions(TYPES)}
              />
              <SelectField
                name="work_mode"
                label="Work mode"
                errors={errors}
                value={form.work_mode}
                onChange={(work_mode) => setForm((f) => ({ ...f, work_mode }))}
                options={enumOptions(MODES)}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="hire_date"
                label="Hire date"
                type="date"
                required
                errors={errors}
                value={form.hire_date}
                onChange={(hire_date) => setForm((f) => ({ ...f, hire_date }))}
              />
              <TextField
                name="probation_end_date"
                label="Probation ends"
                type="date"
                errors={errors}
                value={form.probation_end_date}
                onChange={(probation_end_date) =>
                  setForm((f) => ({ ...f, probation_end_date }))
                }
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="work_email"
                label="Work email"
                type="email"
                errors={errors}
                value={form.work_email}
                onChange={(work_email) => setForm((f) => ({ ...f, work_email }))}
              />
              <TextField
                name="timezone"
                label="Timezone"
                hint="Per person, not per company."
                errors={errors}
                value={form.timezone}
                onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
              />
            </FieldRow>
          </>
        )}
      </CrudDialogs>

      {/* Assign to a position */}
      <FormDialog
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
        title={`Assign ${assigning?.person_detail.display_name ?? ""} to a position`}
        description="Assignments are effective-dated. Any existing open assignment must be closed first — the server rejects overlaps."
        submitLabel="Assign"
        onSubmit={() =>
          api.post("/position-assignments/", {
            employment: assigning!.id,
            position: assignForm.position,
            manager_employment: assignForm.manager_employment || null,
            is_primary: true,
            effective_from: assignForm.effective_from,
            change_reason: assignForm.change_reason,
          })
        }
        onSuccess={reload}
      >
        {(errors) => (
          <>
            <SelectField
              name="position"
              label="Position"
              required
              errors={errors}
              value={assignForm.position}
              onChange={(position) => setAssignForm((f) => ({ ...f, position }))}
              options={(positions.data?.results ?? []).map((p) => ({
                value: p.id,
                label: `${p.job_title_name} — ${p.org_unit_name}${
                  p.occupant ? ` (held by ${p.occupant.name})` : ""
                }`,
              }))}
            />
            <SelectField
              name="manager_employment"
              label="Reports to"
              allowEmpty
              hint="Cycles are rejected: their manager cannot already report to them."
              errors={errors}
              value={assignForm.manager_employment}
              onChange={(manager_employment) =>
                setAssignForm((f) => ({ ...f, manager_employment }))
              }
              options={employmentOptions}
            />
            <FieldRow>
              <TextField
                name="effective_from"
                label="Effective from"
                type="date"
                required
                errors={errors}
                value={assignForm.effective_from}
                onChange={(effective_from) =>
                  setAssignForm((f) => ({ ...f, effective_from }))
                }
              />
              <SelectField
                name="change_reason"
                label="Reason"
                errors={errors}
                value={assignForm.change_reason}
                onChange={(change_reason) =>
                  setAssignForm((f) => ({ ...f, change_reason }))
                }
                options={enumOptions(REASONS)}
              />
            </FieldRow>
          </>
        )}
      </FormDialog>

      {/* Lifecycle transition */}
      <FormDialog
        open={transitioning !== null}
        onOpenChange={(open) => !open && setTransitioning(null)}
        title={`Change status — ${transitioning?.employee_code ?? ""}`}
        description={`Currently ${transitioning?.status.toLowerCase() ?? ""}. Only the transitions the lifecycle allows are offered.`}
        submitLabel="Change status"
        onSubmit={() =>
          api.post(
            `/employments/${transitioning!.id}/change-status/`,
            transitionForm,
          )
        }
        onSuccess={reload}
      >
        {(errors) => (
          <>
            <SelectField
              name="to_status"
              label="New status"
              required
              errors={errors}
              value={transitionForm.to_status}
              onChange={(to_status) => setTransitionForm((f) => ({ ...f, to_status }))}
              options={enumOptions(transitioning?.allowed_transitions ?? [])}
            />
            <TextField
              name="effective_from"
              label="Effective from"
              type="date"
              required
              errors={errors}
              value={transitionForm.effective_from}
              onChange={(effective_from) =>
                setTransitionForm((f) => ({ ...f, effective_from }))
              }
            />
            <TextField
              name="reason"
              label="Reason"
              hint="Recorded on the status-change history."
              errors={errors}
              value={transitionForm.reason}
              onChange={(reason) => setTransitionForm((f) => ({ ...f, reason }))}
            />
          </>
        )}
      </FormDialog>
    </>
  )
}
