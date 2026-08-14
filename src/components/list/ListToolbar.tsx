import type { ReactNode } from "react"

/**
 * The row of search and filter controls above a table.
 *
 * One place for the layout, so ten screens cannot drift into ten spacings.
 */
export default function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  )
}
