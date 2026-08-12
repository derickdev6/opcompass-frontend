/**
 * The single HTTP client for the OP Compass API.
 *
 * Nothing else in the app calls `fetch` directly. Centralising it is what keeps
 * the token handling in one reviewable place.
 *
 * The access token lives in a module-scoped variable — in memory, never in
 * localStorage or sessionStorage, which any script running on the page can
 * read. The refresh token is never visible to this file at all: the server
 * sets it as an HttpOnly cookie and the browser attaches it automatically to
 * /api/v1/auth/ requests.
 *
 * Losing the access token on reload is therefore harmless — `refreshSession()`
 * trades the cookie for a new one during start-up.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"

let accessToken: string | null = null

/** In-flight refresh, so ten parallel 401s cause one refresh and not ten. */
let refreshInFlight: Promise<boolean> | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Trade the refresh cookie for a new access token.
 * Returns whether a session survived.
 */
export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh/`, {
          method: "POST",
          credentials: "include",
        })
        if (!response.ok) return false

        const data = (await response.json()) as { access: string }
        accessToken = data.access
        return true
      } catch {
        return false
      } finally {
        // Cleared on the next tick so every caller awaiting this promise sees
        // the same result before a fresh attempt can start.
        setTimeout(() => {
          refreshInFlight = null
        }, 0)
      }
    })()
  }
  return refreshInFlight
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Set on the auth endpoints, which must not recurse into a refresh. */
  skipAuthRetry?: boolean
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuthRetry = false } = options

  const send = () => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers["Content-Type"] = "application/json"
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`

    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  let response = await send()

  if (response.status === 401 && !skipAuthRetry) {
    if (await refreshSession()) {
      response = await send()
    } else {
      accessToken = null
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Request failed with status ${response.status}`)
  }

  return response.status === 204 ? (null as T) : ((await response.json()) as T)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
}
