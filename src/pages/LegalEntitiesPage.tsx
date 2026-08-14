import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, TextField } from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
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
import type { LegalEntity } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const EMPTY = { name: "", tax_id: "", country: "", currency: "USD", timezone: "UTC" }

export default function LegalEntitiesPage() {
  const params = useListParams({ ordering: "name" })
  const { data, error, isLoading, reload } = useApi<Paginated<LegalEntity>>(
    `/legal-entities/${params.queryString}`,
  )
  const crud = useCrud<LegalEntity>("/legal-entities", reload)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (crud.editing) {
      const { name, tax_id, country, currency, timezone } = crud.editing
      setForm({ name, tax_id, country, currency, timezone })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <PageHeader
        title="Legal entities"
        description="The companies that do the contracting. Every employment belongs to one."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New entity
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search legal entities"
          placeholder="Search by name, tax ID or country…"
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No legal entities match."
            hint="Create one before adding employments."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="tax_id" {...params.sort}>Tax ID</SortableHead>
                  <SortableHead field="country" {...params.sort}>Country</SortableHead>
                  <SortableHead field="currency" {...params.sort}>Currency</SortableHead>
                  <SortableHead field="timezone" {...params.sort}>Timezone</SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entity.tax_id || "—"}
                    </TableCell>
                    <TableCell>{entity.country}</TableCell>
                    <TableCell>{entity.currency}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entity.timezone}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(entity) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(entity),
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
        noun="legal entity"
        plural="legal entities"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="legal entity"
        labelOf={(e) => e.name}
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
              <TextField
                name="tax_id"
                label="Tax ID"
                errors={errors}
                value={form.tax_id}
                onChange={(tax_id) => setForm((f) => ({ ...f, tax_id }))}
              />
              <TextField
                name="country"
                label="Country"
                required
                hint="ISO 3166-1 alpha-2"
                errors={errors}
                value={form.country}
                onChange={(country) =>
                  setForm((f) => ({ ...f, country: country.toUpperCase().slice(0, 2) }))
                }
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="currency"
                label="Currency"
                hint="ISO 4217, e.g. USD"
                errors={errors}
                value={form.currency}
                onChange={(currency) =>
                  setForm((f) => ({ ...f, currency: currency.toUpperCase().slice(0, 3) }))
                }
              />
              <TextField
                name="timezone"
                label="Timezone"
                errors={errors}
                value={form.timezone}
                onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
              />
            </FieldRow>
          </>
        )}
      </CrudDialogs>
    </>
  )
}
