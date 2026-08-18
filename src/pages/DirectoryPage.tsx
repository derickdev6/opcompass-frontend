import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import { enumOptions } from "@/components/form/Field"
import FilterMenu from "@/components/list/FilterMenu"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import StatusBadge from "@/components/StatusBadge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Paginated } from "@/lib/api"
import type { DirectoryEntry } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useListParams } from "@/lib/useListParams"

const STATUSES = [
  "ONBOARDING",
  "TRAINING",
  "PROBATION",
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "OFFBOARDING",
] as const
const MODES = ["ONSITE", "REMOTE", "HYBRID"] as const

export default function DirectoryPage() {
  const params = useListParams({
    ordering: "name",
    filters: { status: [], work_mode: [] },
  })

  const { data, error, isLoading } = useApi<Paginated<DirectoryEntry>>(
    `/directory/${params.queryString}`,
  )

  return (
    <>
      <PageHeader
        title="Directory"
        description="Everyone currently employed, with their seat and reporting line."
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search the directory"
          placeholder="Search by name, code, email or team…"
        />
        <FilterMenu
          label="Status"
          allLabel="All statuses"
          values={params.filters.status}
          onChange={(values) => params.setFilter("status", values)}
          options={enumOptions(STATUSES)}
        />
        <FilterMenu
          label="Work mode"
          allLabel="All work modes"
          values={params.filters.work_mode}
          onChange={(values) => params.setFilter("work_mode", values)}
          options={enumOptions(MODES)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No one matches."
            hint="Clear the search and filters, or add an employment to see someone here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="employee_code" {...params.sort}>Code</SortableHead>
                  <SortableHead field="job_title" {...params.sort}>Job title</SortableHead>
                  <SortableHead field="org_unit" {...params.sort}>Org unit</SortableHead>
                  <SortableHead field="manager_name" {...params.sort}>Manager</SortableHead>
                  <SortableHead field="location" {...params.sort}>Location</SortableHead>
                  <SortableHead field="status" {...params.sort}>Status</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="font-medium">{entry.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.work_email || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {entry.employee_code}
                    </TableCell>
                    <TableCell>{entry.job_title ?? "—"}</TableCell>
                    <TableCell>{entry.org_unit ?? "—"}</TableCell>
                    <TableCell>{entry.manager_name ?? "—"}</TableCell>
                    <TableCell>{entry.location ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
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
        noun="person"
        plural="people"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />
    </>
  )
}
