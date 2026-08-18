import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import FilterMenu from "@/components/list/FilterMenu"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type { AuditEvent } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useListParams } from "@/lib/useListParams"

export default function AuditPage() {
  const params = useListParams({
    ordering: "-occurred_at",
    filters: { subject_type: [] },
  })
  const { data, error, isLoading } = useApi<Paginated<AuditEvent>>(
    `/audit-events/${params.queryString}`,
  )

  // The set of subjects grows with the modules, so the filter reads it off the
  // log rather than hard-coding today's list. 200 is the API's max page size,
  // so this only sees recent subjects — see API_REQUIREMENTS.md §7.
  const all = useApi<Paginated<AuditEvent>>(
    `/audit-events/${query({ page_size: 200 })}`,
  )
  const subjectOptions = [
    ...new Set((all.data?.results ?? []).map((event) => event.subject_type)),
  ]
    .sort()
    .map((subject) => ({
      value: subject,
      label: subject.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
    }))

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every meaningful change, with its author and timestamp. Append-only — nothing here can be edited or deleted."
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search the audit log"
          placeholder="Search by action, actor or subject…"
        />
        <FilterMenu
          label="Subject"
          allLabel="All subjects"
          values={params.filters.subject_type}
          onChange={(values) => params.setFilter("subject_type", values)}
          options={subjectOptions}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="Nothing matches."
            hint="Events appear as soon as records are created or changed."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="occurred_at" {...params.sort}>When</SortableHead>
                  <SortableHead field="action" {...params.sort}>Action</SortableHead>
                  <SortableHead field="subject_type" {...params.sort}>
                    Subject
                  </SortableHead>
                  <SortableHead field="actor_email" {...params.sort}>Actor</SortableHead>
                  <SortableHead field="ip" {...params.sort}>IP</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {new Date(event.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs font-normal">
                        {event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">
                      {event.subject_type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>{event.actor_email ?? "system"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.ip ?? "—"}
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
        noun="event"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />
    </>
  )
}
