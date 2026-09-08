import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import {
  CheckboxField,
  FieldRow,
  SelectField,
  TextField,
  enumOptions,
} from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import FilterMenu from "@/components/list/FilterMenu"
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
import { query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { JobTitle, Location, OrgUnit, Position } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const STATUSES = ["OPEN", "FILLED", "FROZEN", "CLOSED"] as const
const SENIORITIES = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "MANAGER",
  "DIRECTOR",
  "EXEC",
] as const

const EMPTY = {
  job_title: "",
  org_unit: "",
  location: "",
  seniority: "MID",
  status: "OPEN",
  is_people_manager: false,
  salary_band_min: "",
  salary_band_max: "",
  currency: "USD",
  headcount: "1",
}

export default function PositionsPage() {
  const params = useListParams({
    ordering: "job_title_name",
    filters: { status: [], seniority: [] },
  })

  const { data, error, isLoading, reload } = useApi<Paginated<Position>>(
    `/positions/${params.queryString}`,
  )
  const titles = useApi<Paginated<JobTitle>>(`/job-titles/${query({ page_size: 200 })}`)
  const units = useApi<Paginated<OrgUnit>>(`/org-units/${query({ page_size: 200 })}`)
  const locations = useApi<Paginated<Location>>(`/locations/${query({ page_size: 200 })}`)

  const crud = useCrud<Position>("/positions", reload)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (crud.editing) {
      const p = crud.editing
      setForm({
        job_title: p.job_title,
        org_unit: p.org_unit,
        location: p.location ?? "",
        seniority: p.seniority,
        status: p.status,
        is_people_manager: p.is_people_manager,
        salary_band_min: p.salary_band_min ?? "",
        salary_band_max: p.salary_band_max ?? "",
        currency: p.currency,
        headcount: String(p.headcount),
      })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <PageHeader
        title="Positions"
        description="Seats in the organisation. A position is a headcount slot, distinct from a job title."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New position
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search positions"
          placeholder="Search by title, unit, location or occupant…"
        />
        <FilterMenu
          label="Status"
          allLabel="All statuses"
          values={params.filters.status}
          onChange={(values) => params.setFilter("status", values)}
          sorted={false}
          options={enumOptions(STATUSES)}
        />
        <FilterMenu
          label="Seniority"
          allLabel="All seniorities"
          values={params.filters.seniority}
          onChange={(values) => params.setFilter("seniority", values)}
          sorted={false}
          options={enumOptions(SENIORITIES)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No positions match."
            hint="A position needs a job title and an org unit."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="job_title_name" {...params.sort}>
                    Job title
                  </SortableHead>
                  <SortableHead field="org_unit_name" {...params.sort}>
                    Org unit
                  </SortableHead>
                  <SortableHead field="seniority" {...params.sort}>Seniority</SortableHead>
                  <SortableHead field="location_name" {...params.sort}>
                    Location
                  </SortableHead>
                  <SortableHead field="occupant.name" {...params.sort}>
                    Occupant
                  </SortableHead>
                  <SortableHead field="salary_band_min" {...params.sort}>Band</SortableHead>
                  <SortableHead field="status" {...params.sort}>Status</SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div className="font-medium">{position.job_title_name}</div>
                      {position.is_people_manager && (
                        <div className="text-xs text-muted-foreground">
                          People manager
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{position.org_unit_name}</TableCell>
                    <TableCell className="capitalize">
                      {position.seniority.toLowerCase()}
                    </TableCell>
                    <TableCell>{position.location_name ?? "—"}</TableCell>
                    <TableCell>
                      {position.occupant ? (
                        <>
                          <div>{position.occupant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {position.occupant.employee_code}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Vacant</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {position.salary_band_min && position.salary_band_max
                        ? `${position.salary_band_min}–${position.salary_band_max} ${position.currency}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={position.status} />
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(position) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(position),
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
        noun="position"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="position"
        labelOf={(p) => `${p.job_title_name} — ${p.org_unit_name}`}
        description="Status moves to Filled automatically when someone is assigned."
        buildBody={() => ({
          ...form,
          location: form.location || null,
          salary_band_min: form.salary_band_min || null,
          salary_band_max: form.salary_band_max || null,
          headcount: Number(form.headcount) || 1,
        })}
      >
        {(errors) => (
          <>
            <SelectField
              name="job_title"
              label="Job title"
              required
              errors={errors}
              value={form.job_title}
              onChange={(job_title) => setForm((f) => ({ ...f, job_title }))}
              options={(titles.data?.results ?? []).map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
            <SelectField
              name="org_unit"
              label="Org unit"
              required
              errors={errors}
              value={form.org_unit}
              onChange={(org_unit) => setForm((f) => ({ ...f, org_unit }))}
              options={(units.data?.results ?? []).map((u) => ({
                value: u.id,
                label: `${u.code} — ${u.name}`,
              }))}
            />
            <FieldRow>
              <SelectField
                name="location"
                label="Location"
                allowEmpty
                errors={errors}
                value={form.location}
                onChange={(location) => setForm((f) => ({ ...f, location }))}
                options={(locations.data?.results ?? []).map((l) => ({
                  value: l.id,
                  label: l.name,
                }))}
              />
              <SelectField
                name="seniority"
                label="Seniority"
                errors={errors}
                value={form.seniority}
                onChange={(seniority) => setForm((f) => ({ ...f, seniority }))}
                sorted={false}
                options={enumOptions(SENIORITIES)}
              />
            </FieldRow>
            <FieldRow>
              <SelectField
                name="status"
                label="Status"
                errors={errors}
                value={form.status}
                onChange={(status) => setForm((f) => ({ ...f, status }))}
                sorted={false}
                options={enumOptions(STATUSES)}
              />
              <TextField
                name="headcount"
                label="Headcount"
                type="number"
                errors={errors}
                value={form.headcount}
                onChange={(headcount) => setForm((f) => ({ ...f, headcount }))}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="salary_band_min"
                label="Band minimum"
                type="number"
                errors={errors}
                value={form.salary_band_min}
                onChange={(salary_band_min) =>
                  setForm((f) => ({ ...f, salary_band_min }))
                }
              />
              <TextField
                name="salary_band_max"
                label="Band maximum"
                type="number"
                errors={errors}
                value={form.salary_band_max}
                onChange={(salary_band_max) =>
                  setForm((f) => ({ ...f, salary_band_max }))
                }
              />
            </FieldRow>
            <TextField
              name="currency"
              label="Currency"
              errors={errors}
              value={form.currency}
              onChange={(currency) =>
                setForm((f) => ({ ...f, currency: currency.toUpperCase().slice(0, 3) }))
              }
            />
            <CheckboxField
              name="is_people_manager"
              label="This position manages people"
              hint="Drives permission scoping."
              errors={errors}
              checked={form.is_people_manager}
              onChange={(is_people_manager) =>
                setForm((f) => ({ ...f, is_people_manager }))
              }
            />
          </>
        )}
      </CrudDialogs>
    </>
  )
}
