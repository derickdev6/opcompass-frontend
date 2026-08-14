import { ChevronDown, ChevronRight, Users } from "lucide-react"
import { useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import PageHeader from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { OrgUnitNode } from "@/lib/types"
import { useApi } from "@/lib/useApi"

export default function OrgChartPage() {
  const { data, error, isLoading } = useApi<OrgUnitNode[]>("/org-units/tree/")

  return (
    <>
      <PageHeader
        title="Org chart"
        description="The reporting structure, from the company node down to each team."
      />

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            message="No org units yet."
            hint="Create a COMPANY unit first, then add divisions, departments and teams under it."
          />
        ) : (
          <ul className="p-2">
            {data.map((node) => (
              <OrgNode key={node.id} node={node} depth={0} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function OrgNode({ node, depth }: { node: OrgUnitNode; depth: number }) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          >
            {open ? (
              <ChevronDown className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <span className="font-medium">{node.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{node.code}</span>
        <Badge variant="outline" className="font-normal capitalize">
          {node.type.toLowerCase()}
        </Badge>

        {node.position_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3" aria-hidden />
            {node.position_count}
          </span>
        )}

        {node.lead_name && (
          <span className="ml-auto truncate text-sm text-muted-foreground">
            Lead: {node.lead_name}
          </span>
        )}
      </div>

      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <OrgNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
