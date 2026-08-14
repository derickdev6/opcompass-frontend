/**
 * The mock backend's entry point.
 *
 * `api.ts` calls `mockFetch` in place of `fetch` when mock mode is on. It
 * returns a real `Response`, so every path downstream of the transport — the
 * error envelope, the 401 refresh-and-retry, the 204 handling — runs exactly as
 * it does against Django. There is no second code path to keep in step.
 *
 * See `mock_data/README.md` for what is and is not simulated.
 */

import { resetDb } from "./db"
import { handle } from "./routes"

/** Enough delay that loading skeletons actually render. */
const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY_MS ?? 180)

const delay = () =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, LATENCY_MS)))

export async function mockFetch(
  method: string,
  path: string,
  body: unknown,
  authorization: string | null,
): Promise<Response> {
  await delay()

  const result = handle(method.toUpperCase(), path, body, authorization)

  if (result.status === 204) return new Response(null, { status: 204 })

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  })
}

/** Throw away everything created this session and re-seed. */
export function resetMockData(): void {
  resetDb()
}

console.info(
  "%c[mock]%c OP Compass is running on mock data — no backend, no database. " +
    "Set VITE_USE_MOCK_API=false to talk to Django instead.",
  "font-weight:bold",
  "",
)
