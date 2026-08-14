import { ChevronLeft, ChevronRight } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PAGE_SIZES } from "@/lib/useListParams"

/**
 * The bar under a table: what you are looking at, how many rows per page, and
 * the two page controls.
 *
 * `count` is the API's total, not `results.length` — the whole point is to say
 * how much is *not* on screen.
 */
export default function Pagination({
  page,
  pageSize,
  count,
  noun,
  plural,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageSize: number
  count: number
  /** Singular, e.g. "employment". */
  noun: string
  /** Only when adding an "s" is wrong: person → people. */
  plural?: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const selectId = useId()

  // Nothing to page through, and the screen is already showing its empty state.
  if (count === 0) return null

  const pages = Math.max(1, Math.ceil(count / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, count)
  const word = count === 1 ? noun : (plural ?? `${noun}s`)

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium tabular-nums text-foreground">
          {first}–{last}
        </span>{" "}
        of <span className="font-medium tabular-nums text-foreground">{count}</span>{" "}
        {word}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor={selectId} className="whitespace-nowrap text-sm font-normal text-muted-foreground">
            Rows per page
          </Label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger id={selectId} className="h-8 w-[4.5rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
