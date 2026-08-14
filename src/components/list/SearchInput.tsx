import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"

/**
 * The search box for a list screen. Debouncing lives in `useListParams`, so
 * this stays a controlled input and nothing else.
 */
export default function SearchInput({
  value,
  onChange,
  label,
  placeholder = "Search…",
}: {
  value: string
  onChange: (value: string) => void
  /** Announced to screen readers; the box carries no visible label. */
  label: string
  placeholder?: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9"
      />
    </div>
  )
}
