import { useCallback, useMemo, useState } from "react"

import { query } from "@/lib/api"
import { useDebounced } from "@/lib/useDebounced"

/**
 * Search, filter, sort and page state for one list screen.
 *
 * All four are **server-side**: the hook's only output that matters is
 * `queryString`, which goes straight onto the collection path. Sorting a column
 * sorts the whole collection, not the ten rows currently on screen — the
 * difference is the entire point of doing it this way, and it is why none of
 * this is done in the browser.
 *
 * Every setter resets to page 1. Landing on page 4 of a result set that now has
 * one page is the classic bug here.
 */

/** Radix Select cannot hold an empty string, so this stands for "no filter". */
export const ALL = "all"

export const PAGE_SIZES = [10, 20, 50, 100]

export interface ListParams {
  page: number
  pageSize: number
  /** A field name, or `-field` for descending. Empty means the API's default. */
  ordering: string
  search: string
  filters: Record<string, string>
  /** Spread onto every `<SortableHead>`: `<SortableHead field="name" {...params.sort}>`. */
  sort: { ordering: string; onSort: (field: string) => void }
  /** Append to the collection path: `/people/${params.queryString}`. */
  queryString: string
  setSearch: (value: string) => void
  setFilter: (key: string, value: string) => void
  toggleSort: (field: string) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

interface Options {
  /** Initial sort, e.g. `"name"` or `"-hire_date"`. */
  ordering?: string
  /** The filters this screen exposes, keyed by query parameter. */
  filters?: Record<string, string>
}

export function useListParams({
  ordering: initialOrdering = "",
  filters: initialFilters = {},
}: Options = {}): ListParams {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(PAGE_SIZES[0])
  const [ordering, setOrdering] = useState(initialOrdering)
  const [search, setSearchState] = useState("")
  const [filters, setFilters] = useState(initialFilters)

  // The box updates on every keystroke; the request does not.
  const debouncedSearch = useDebounced(search, 300)

  const setSearch = useCallback((value: string) => {
    setSearchState(value)
    setPage(1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPage(1)
  }, [])

  /** Click a column to sort by it; click it again to reverse. */
  const toggleSort = useCallback((field: string) => {
    setOrdering((current) => (current === field ? `-${field}` : field))
    setPage(1)
  }, [])

  const queryString = useMemo(() => {
    const active: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== ALL) active[key] = value
    }
    return query({
      search: debouncedSearch,
      ordering,
      // Omitted on the first page, so the common request stays readable.
      page: page > 1 ? page : undefined,
      page_size: pageSize,
      ...active,
    })
  }, [debouncedSearch, ordering, page, pageSize, filters])

  const sort = useMemo(() => ({ ordering, onSort: toggleSort }), [ordering, toggleSort])

  return {
    page,
    pageSize,
    ordering,
    search,
    filters,
    sort,
    queryString,
    setSearch,
    setFilter,
    toggleSort,
    setPage,
    setPageSize,
  }
}
