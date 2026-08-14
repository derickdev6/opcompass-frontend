import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import type { ReactNode } from "react"

import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * A column header that sorts the collection.
 *
 * `field` is the API's ordering key, not the column label — sorting happens on
 * the server, across every row, not just the page on screen.
 *
 * `aria-sort` is on the `<th>` so a screen reader announces the direction; the
 * arrow alone would leave that reader with nothing.
 */
export default function SortableHead({
  field,
  ordering,
  onSort,
  children,
  className,
}: {
  field: string
  ordering: string
  onSort: (field: string) => void
  children: ReactNode
  className?: string
}) {
  const descending = ordering === `-${field}`
  const active = descending || ordering === field
  const Icon = active ? (descending ? ArrowDown : ArrowUp) : ChevronsUpDown

  return (
    <TableHead
      className={className}
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {children}
        <Icon
          className={cn("size-3.5 shrink-0", !active && "opacity-40")}
          aria-hidden
        />
      </button>
    </TableHead>
  )
}
