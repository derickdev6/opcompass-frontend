import { MoreHorizontal } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface RowAction {
  label: string
  onSelect: () => void
  /** Renders in the destructive colour and below a separator. */
  destructive?: boolean
  icon?: ReactNode
}

/** The "…" menu at the end of a table row. */
export default function RowActions({ actions }: { actions: RowAction[] }) {
  const normal = actions.filter((a) => !a.destructive)
  const destructive = actions.filter((a) => a.destructive)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Row actions">
          <MoreHorizontal className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {normal.map((action) => (
          <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
        {destructive.length > 0 && normal.length > 0 && <DropdownMenuSeparator />}
        {destructive.map((action) => (
          <DropdownMenuItem
            key={action.label}
            onSelect={action.onSelect}
            variant="destructive"
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
