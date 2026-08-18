import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, TextAreaField, TextField } from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import FilterMenu from "@/components/list/FilterMenu"
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
import { query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { JobTitle } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const EMPTY = { name: "", code: "", job_family: "", description: "" }

export default function JobTitlesPage() {
  const params = useListParams({ ordering: "name", filters: { job_family: [] } })
  const { data, error, isLoading, reload } = useApi<Paginated<JobTitle>>(
    `/job-titles/${params.queryString}`,
  )
  // Job family is free text, so the filter's options come from the data rather
  // than a fixed enum. Unpaged, or the list would only offer the families that
  // happen to be on the current page.
  const all = useApi<Paginated<JobTitle>>(`/job-titles/${query({ page_size: 200 })}`)

  // Both lists refresh on a write: a new title can introduce a new family.
  const crud = useCrud<JobTitle>("/job-titles", () => {
    reload()
    all.reload()
  })
  const familyOptions = [
    ...new Set((all.data?.results ?? []).map((t) => t.job_family).filter(Boolean)),
  ]
    .sort()
    .map((family) => ({ value: family, label: family }))
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (crud.editing) {
      const { name, code, job_family, description } = crud.editing
      setForm({ name, code, job_family, description })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <PageHeader
        title="Job titles"
        description="The catalog of titles. A title is reusable; a position is one seat that uses it."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New job title
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search job titles"
          placeholder="Search by name, code or family…"
        />
        <FilterMenu
          label="Family"
          allLabel="All families"
          values={params.filters.job_family}
          onChange={(values) => params.setFilter("job_family", values)}
          options={familyOptions}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No job titles match."
            hint="Positions need a job title, so start here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="code" {...params.sort}>Code</SortableHead>
                  <SortableHead field="job_family" {...params.sort}>Family</SortableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((title) => (
                  <TableRow key={title.id}>
                    <TableCell className="font-medium">{title.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {title.code || "—"}
                    </TableCell>
                    <TableCell>{title.job_family || "—"}</TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground">
                      {title.description || "—"}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(title) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(title),
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
        noun="job title"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="job title"
        labelOf={(t) => t.name}
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
                name="code"
                label="Code"
                errors={errors}
                value={form.code}
                onChange={(code) => setForm((f) => ({ ...f, code }))}
              />
              <TextField
                name="job_family"
                label="Job family"
                hint="e.g. Engineering, Operations"
                errors={errors}
                value={form.job_family}
                onChange={(job_family) => setForm((f) => ({ ...f, job_family }))}
              />
            </FieldRow>
            <TextAreaField
              name="description"
              label="Description"
              errors={errors}
              value={form.description}
              onChange={(description) => setForm((f) => ({ ...f, description }))}
            />
          </>
        )}
      </CrudDialogs>
    </>
  )
}
