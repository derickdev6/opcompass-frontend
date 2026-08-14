import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, SelectField, TextField, enumOptions } from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import FilterSelect from "@/components/list/FilterSelect"
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
import type { Location } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { ALL, useListParams } from "@/lib/useListParams"

const TYPES = ["OFFICE", "REMOTE", "HYBRID_HUB", "CLIENT_SITE"] as const

const EMPTY = { name: "", type: "OFFICE", country: "", timezone: "UTC" }

export default function LocationsPage() {
  const params = useListParams({ ordering: "name", filters: { type: ALL } })
  const { data, error, isLoading, reload } = useApi<Paginated<Location>>(
    `/locations/${params.queryString}`,
  )
  const crud = useCrud<Location>("/locations", reload)
  const [form, setForm] = useState(EMPTY)

  // Seed the form when a dialog opens: the edit dialog starts from the record,
  // the create dialog from blank.
  useEffect(() => {
    if (crud.editing) {
      setForm({
        name: crud.editing.name,
        type: crud.editing.type,
        country: crud.editing.country,
        timezone: crud.editing.timezone,
      })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <PageHeader
        title="Locations"
        description="Physical sites and remote designations. Positions are placed at a location."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New location
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search locations"
          placeholder="Search by name, country or timezone…"
        />
        <FilterSelect
          label="Type"
          allLabel="All types"
          value={params.filters.type}
          onChange={(value) => params.setFilter("type", value)}
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
            message="No locations match."
            hint="Add one before creating positions."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="type" {...params.sort}>Type</SortableHead>
                  <SortableHead field="country" {...params.sort}>Country</SortableHead>
                  <SortableHead field="timezone" {...params.sort}>Timezone</SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal capitalize">
                        {location.type.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{location.country}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {location.timezone}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(location) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(location),
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
        noun="location"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="location"
        labelOf={(l) => l.name}
        buildBody={() => form}
      >
        {(errors) => (
          <>
            <TextField
              name="name"
              label="Name"
              required
              errors={errors}
              value={form.name}
              onChange={(name) => setForm((f) => ({ ...f, name }))}
            />
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
                name="country"
                label="Country"
                required
                hint="ISO 3166-1 alpha-2, e.g. VE"
                errors={errors}
                value={form.country}
                onChange={(country) =>
                  setForm((f) => ({ ...f, country: country.toUpperCase().slice(0, 2) }))
                }
              />
            </FieldRow>
            <TextField
              name="timezone"
              label="Timezone"
              hint="IANA name, e.g. America/Caracas"
              errors={errors}
              value={form.timezone}
              onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
            />
          </>
        )}
      </CrudDialogs>
    </>
  )
}
