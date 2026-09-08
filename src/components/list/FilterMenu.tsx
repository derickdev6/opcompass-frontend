import { Check, ChevronDown } from "lucide-react"

import { sortOptions } from "@/components/form/Field"
import type { Option } from "@/components/form/Field"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * One multi-select filter.
 *
 * Values are OR'd: ticking Active, On leave and Suspended asks for all three in
 * one request. An empty selection means the filter is off entirely, which is
 * why there is no "all" entry to tick — clearing is how you get everything.
 *
 * The values are raw API codes (`ACTIVE`, `FULL_TIME`) because they go straight
 * onto the query string; only the labels are prettified.
 */
export default function FilterMenu({
  label,
  allLabel,
  options,
  sorted = true,
  values,
  onChange,
}: {
  /** Announced to screen readers, and the fallback for the empty state. */
  label: string
  allLabel?: string
  options: Option[]
  /** Off for scales whose own order carries meaning, like seniority. */
  sorted?: boolean
  values: string[]
  onChange: (values: string[]) => void
}) {
  const empty = allLabel ?? `All ${label.toLowerCase()}`

  const toggle = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    )
  }

  // One selection reads as itself; more than one would not fit, so the count
  // carries the rest.
  const selectedLabel =
    values.length === 0
      ? empty
      : values.length === 1
        ? (options.find((option) => option.value === values[0])?.label ?? values[0])
        : `${label}: ${values.length}`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          className={cn(
            "w-full justify-between font-normal sm:w-44",
            values.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto">
        {(sorted ? sortOptions(options) : options).map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={values.includes(option.value)}
            // Without this the menu closes after every tick, which makes
            // picking three statuses three trips.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={() => toggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}

        {values.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>
              <Check className="size-4 opacity-0" aria-hidden />
              Clear {label.toLowerCase()}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
