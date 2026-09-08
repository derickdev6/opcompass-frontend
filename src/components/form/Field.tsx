import type { ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { FieldErrors } from "@/components/form/FormDialog"
import { cn } from "@/lib/utils"

interface BaseProps {
  name: string
  label: string
  errors: FieldErrors
  hint?: string
  required?: boolean
}

/** Wrapper that renders the label, the control and any server error for it. */
function Wrapper({
  name,
  label,
  errors,
  hint,
  required,
  children,
}: BaseProps & { children: ReactNode }) {
  const message = errors[name]?.join(" ")
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && !message && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

export function TextField({
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  ...base
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <Wrapper {...base}>
      <Input
        id={base.name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(base.errors[base.name])}
        onChange={(event) => onChange(event.target.value)}
        className={cn(base.errors[base.name] && "border-destructive")}
      />
    </Wrapper>
  )
}

export function TextAreaField({
  value,
  onChange,
  rows = 3,
  ...base
}: BaseProps & { value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <Wrapper {...base}>
      <Textarea
        id={base.name}
        rows={rows}
        value={value}
        aria-invalid={Boolean(base.errors[base.name])}
        onChange={(event) => onChange(event.target.value)}
      />
    </Wrapper>
  )
}

export interface Option {
  value: string
  label: string
}

/**
 * Every dropdown lists its options alphabetically, so a name is found the same
 * way in all of them. Sorting happens where the options are rendered rather
 * than at each call site, so a new selector cannot forget to do it.
 *
 * `sensitivity: "base"` files accented names with their unaccented spelling —
 * Pena and Peña land together — and `numeric` keeps codes like OPS-2 before
 * OPS-10.
 */
export function sortOptions(options: Option[]): Option[] {
  return [...options].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base", numeric: true }),
  )
}

export function SelectField({
  value,
  onChange,
  options,
  sorted = true,
  placeholder = "Select…",
  allowEmpty = false,
  ...base
}: BaseProps & {
  value: string
  onChange: (value: string) => void
  options: Option[]
  /** Off for scales whose own order carries meaning, like seniority. */
  sorted?: boolean
  placeholder?: string
  allowEmpty?: boolean
}) {
  // Radix Select cannot hold an empty-string value, so "none" is a sentinel
  // that is translated back to "" on the way out.
  const NONE = "__none__"
  return (
    <Wrapper {...base}>
      <Select
        value={value === "" ? NONE : value}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
      >
        <SelectTrigger
          id={base.name}
          aria-invalid={Boolean(base.errors[base.name])}
          className={cn("w-full", base.errors[base.name] && "border-destructive")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={NONE}>— None —</SelectItem>}
          {(sorted ? sortOptions(options) : options).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Wrapper>
  )
}

export function CheckboxField({
  checked,
  onChange,
  label,
  name,
  errors,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  name: string
  errors: FieldErrors
  hint?: string
}) {
  const message = errors[name]?.join(" ")
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={name}
          checked={checked}
          onCheckedChange={(next) => onChange(next === true)}
        />
        <Label htmlFor={name} className="font-normal">
          {label}
        </Label>
      </div>
      {hint && !message && <p className="text-xs text-muted-foreground">{hint}</p>}
      {message && (
        <p role="alert" className="text-xs text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

/** Two fields side by side on wide screens, stacked on narrow ones. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

/** Turn an enum-ish list of codes into Select options with readable labels. */
export function enumOptions(values: readonly string[]): Option[] {
  return values.map((value) => ({
    value,
    label: value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/^./, (c) => c.toUpperCase()),
  }))
}
