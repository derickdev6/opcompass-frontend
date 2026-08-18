import { CalendarIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * A date field that opens a real calendar.
 *
 * `<input type="date">` was here first and its native picker is inconsistent —
 * a different widget per browser, and on some none at all until you find the
 * tiny icon. This is one calendar everywhere.
 *
 * The value is a plain `YYYY-MM-DD` string, converted at the edges. Everything
 * stays in **local** time: parsing that string with `new Date()` treats it as
 * UTC and lands on the previous day for anyone west of Greenwich.
 */
export function toDate(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

export function toValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

export default function DatePicker({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Announced to screen readers; the button shows the date itself. */
  label: string
  disabled?: (date: Date) => boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          className={cn("justify-start gap-2 font-normal", className)}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-60" aria-hidden />
          {selected
            ? selected.toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          autoFocus
          selected={selected}
          defaultMonth={selected}
          disabled={disabled}
          onSelect={(date) => {
            if (!date) return
            onChange(toValue(date))
            // Picking a day is the whole interaction; staying open is clutter.
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
