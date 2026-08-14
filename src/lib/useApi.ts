import { useCallback, useEffect, useState } from "react"

import { ApiError, api } from "@/lib/api"

interface State<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  reload: () => void
}

/**
 * Fetch a path and track loading and error state.
 *
 * Deliberately small: there is no cache, no deduplication and no retry. Add a
 * query library when the app actually needs one, not before.
 */
export function useApi<T>(path: string | null): State<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (path === null) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    api
      .get<T>(path)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(
          caught instanceof ApiError
            ? caught.status === 403
              ? "You do not have permission to view this."
              : `Could not load this data (${caught.status}).`
            : "Could not reach the server.",
        )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [path, nonce])

  return { data, error, isLoading, reload }
}
