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

/**
 * Mock mode: on by default in development, off in production builds, and
 * forced either way by `VITE_USE_MOCK_API`. When it is on, no request leaves
 * the browser — `mock_data/` answers instead. See `mock_data/README.md`.
 */
const USE_MOCK_API =
  import.meta.env.VITE_USE_MOCK_API === "true" ||
  (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_API !== "false")

let accessToken: string | null = null

/** In-flight refresh, so ten parallel 401s cause one refresh and not ten. */
let refreshInFlight: Promise<boolean> | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export class ApiError extends Error {
  readonly status: number
  /** Machine-readable code from the API, e.g. "permission_denied". */
  readonly code: string
  /** Per-field validation messages, when the API supplied them. */
  readonly errors: Record<string, string[]> | null

  constructor(
    status: number,
    message: string,
    code = "error",
    errors: Record<string, string[]> | null = null,
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.errors = errors
  }
}

/**
 * The API's error envelope: {detail, code, status, errors?}.
 *
 * Falls back to a generic message when the body is not JSON — which happens if
 * something upstream of Django (nginx, a proxy) produced the failure.
 */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json()
    return new ApiError(
      response.status,
      typeof body.detail === "string" ? body.detail : `Request failed (${response.status}).`,
      typeof body.code === "string" ? body.code : "error",
      body.errors ?? null,
    )
  } catch {
    return new ApiError(response.status, `Request failed (${response.status}).`)
  }
}

/**
 * One trip to the API — the only place a request is actually dispatched.
 *
 * In mock mode the module under `mock_data/` answers instead, returning a real
 * `Response`, so everything above this line behaves identically either way. It
 * is imported dynamically so a production bundle that never enables mocks
 * never downloads the sample data.
 */
async function transport(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Response> {
  if (USE_MOCK_API) {
    const { mockFetch } = await import("../../mock_data/index")
    return mockFetch(method, path, body, headers.Authorization ?? null)
  }

  return fetch(`${API_BASE}${path}`, {
    method,
    headers,
    // Without this the refresh cookie is not sent and session restore
    // silently stops working.
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/**
 * Trade the refresh cookie for a new access token.
 * Returns whether a session survived.
 */
export async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await transport("POST", "/auth/refresh/", {}, undefined)
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

    return transport(method, path, headers, body)
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
    throw await toApiError(response)
  }

  return response.status === 204 ? (null as T) : ((await response.json()) as T)
}

/** Build a query string from a params object, dropping empty values. */
export function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ""
}

/** DRF's page-number pagination envelope. */
export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
