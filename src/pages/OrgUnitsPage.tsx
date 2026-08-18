import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, SelectField, TextField, enumOptions } from "@/components/form/Field"
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
import { query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { Employment, LegalEntity, OrgUnit } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const TYPES = ["COMPANY", "DIVISION", "DEPARTMENT", "TEAM"] as const

const EMPTY = {
  name: "",
  code: "",
  type: "TEAM",
  parent: "",
  legal_entity: "",
  cost_center: "",
  manager_employment: "",
}

export default function OrgUnitsPage() {
  const params = useListParams({ ordering: "code", filters: { type: [] } })
  const { data, error, isLoading, reload } = useApi<Paginated<OrgUnit>>(
    `/org-units/${params.queryString}`,
  )
  const entities = useApi<Paginated<LegalEntity>>(
    `/legal-entities/${query({ page_size: 200 })}`,
  )

  // The parent dropdown needs every unit, not the ten on the current page —
  // the table's pagination must not decide what a unit can hang off.
  const allUnits = useApi<Paginated<OrgUnit>>(
    `/org-units/${query({ page_size: 200, ordering: "code" })}`,
  )

  // And for the manager dropdown, which is filtered to the unit's own members.
  const allEmployments = useApi<Paginated<Employment>>(
    `/employments/${query({ page_size: 200, ordering: "employee_code" })}`,
  )

  const crud = useCrud<OrgUnit>("/org-units", () => {
    reload()
    allUnits.reload()
  })
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (crud.editing) {
      const unit = crud.editing
      setForm({
        name: unit.name,
        code: unit.code,
        type: unit.type,
        parent: unit.parent ?? "",
        legal_entity: unit.legal_entity ?? "",
        cost_center: unit.cost_center,
        manager_employment: unit.manager_employment ?? "",
      })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  // A unit cannot be its own parent. Deeper cycles are rejected by the server,
  // which walks the whole ancestor chain.
  const parentOptions = (allUnits.data?.results ?? [])
    .filter((unit) => unit.id !== crud.editing?.id)
    .map((unit) => ({ value: unit.id, label: `${unit.code} — ${unit.name}` }))

  // A unit's manager must be one of its own **direct** members: Sales is
  // managed from Sales, never by a rep sitting in one of its territories.
  const editingId = crud.editing?.id ?? null
  const members = editingId
    ? (allEmployments.data?.results ?? []).filter(
        (employment) =>
          employment.status !== "TERMINATED" &&
          employment.current_position?.org_unit_id === editingId,
      )
    : []

  const managerOptions = members.map((employment) => ({
    value: employment.id,
    label: `${employment.employee_code} — ${employment.person_detail.display_name}`,
  }))

  // A manager who has since transferred out is still the stored value, so keep
  // them in the list — otherwise the field renders blank and an unrelated edit
  // silently clears it.
  const storedManager = crud.editing?.manager_employment
  if (storedManager && !members.some((employment) => employment.id === storedManager)) {
    const employment = (allEmployments.data?.results ?? []).find(
      (candidate) => candidate.id === storedManager,
    )
    if (employment) {
      managerOptions.unshift({
        value: employment.id,
        label: `${employment.employee_code} — ${employment.person_detail.display_name} (no longer in this unit)`,
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Org units"
        description="Company, divisions, departments and teams. Positions live inside a unit."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New org unit
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search org units"
          placeholder="Search by name, code, parent or manager…"
        />
        <FilterMenu
          label="Type"
          allLabel="All types"
          values={params.filters.type}
          onChange={(values) => params.setFilter("type", values)}
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
            message="No org units match."
            hint="Start with a COMPANY unit; everything else hangs off it."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="code" {...params.sort}>Code</SortableHead>
                  <SortableHead field="name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="type" {...params.sort}>Type</SortableHead>
                  <SortableHead field="parent_name" {...params.sort}>Parent</SortableHead>
                  <SortableHead field="manager_name" {...params.sort}>Manager</SortableHead>
                  <SortableHead field="cost_center" {...params.sort}>
                    Cost center
                  </SortableHead>
                  <SortableHead field="headcount" {...params.sort} className="text-right">
                    Filled
                  </SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-mono text-xs">{unit.code}</TableCell>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize">
                        {unit.type.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{unit.parent_name ?? "—"}</TableCell>
                    <TableCell>{unit.manager_name ?? "—"}</TableCell>
                    <TableCell>{unit.cost_center || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {unit.headcount}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(unit) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(unit),
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
        noun="org unit"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="org unit"
        labelOf={(u) => u.name}
        buildBody={() => ({
          ...form,
          parent: form.parent || null,
          legal_entity: form.legal_entity || null,
          manager_employment: form.manager_employment || null,
        })}
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
                name="code"
                label="Code"
                required
                hint="Unique, e.g. OPS-SUP"
                errors={errors}
                value={form.code}
                onChange={(code) => setForm((f) => ({ ...f, code }))}
              />
            </FieldRow>
            <FieldRow>
              <SelectField
                name="type"
                label="Type"
                errors={errors}
                value={form.type}
                onChange={(type) => setForm((f) => ({ ...f, type }))}
                options={enumOptions(TYPES)}
              />
              <TextField
                name="cost_center"
                label="Cost center"
                errors={errors}
                value={form.cost_center}
                onChange={(cost_center) => setForm((f) => ({ ...f, cost_center }))}
              />
            </FieldRow>
            <SelectField
              name="parent"
              label="Parent unit"
              allowEmpty
              hint="Leave empty for the root company node."
              errors={errors}
              value={form.parent}
              onChange={(parent) => setForm((f) => ({ ...f, parent }))}
              options={parentOptions}
            />
            <SelectField
              name="legal_entity"
              label="Legal entity"
              allowEmpty
              errors={errors}
              value={form.legal_entity}
              onChange={(legal_entity) => setForm((f) => ({ ...f, legal_entity }))}
              options={(entities.data?.results ?? []).map((e) => ({
                value: e.id,
                label: e.name,
              }))}
            />
            <SelectField
              name="manager_employment"
              label="Manager"
              allowEmpty
              hint={
                crud.isCreating
                  ? "Set once the unit has people in it — a manager has to be one of its own members."
                  : managerOptions.length === 0
                    ? "Nobody sits directly in this unit yet. Assign someone to a position here first."
                    : "Everyone in this unit and below reports up through them. Only its own direct members are offered."
              }
              errors={errors}
              value={form.manager_employment}
              onChange={(manager_employment) => setForm((f) => ({ ...f, manager_employment }))}
              options={managerOptions}
            />
          </>
        )}
      </CrudDialogs>
    </>
  )
}
