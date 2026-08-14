import type { Option } from "@/components/form/Field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ALL } from "@/lib/useListParams"

/**
 * One filter dropdown, always with an "everything" entry first.
 *
 * The value is a raw API code (`ACTIVE`, `FULL_TIME`) because it is sent
 * straight to the server as a query parameter; only the label is prettified.
 */
export default function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  /** Announced to screen readers, and the fallback for the "all" entry. */
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  allLabel?: string
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel ?? `All ${label.toLowerCase()}`}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
