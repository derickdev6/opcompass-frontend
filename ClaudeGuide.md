# ClaudeGuide — opcompass-frontend

**Field guide for Claude working in this repository.** Read this file first; it
should be enough to work here without exploring. If you change structure or
conventions, **update this file in the same commit**.

Last verified: 2026-08-12 · Vite 8 · React 19 · TypeScript 6 · Tailwind 4 ·
shadcn (Nova preset, radix base)

---

## 0. Scope discipline — read this before anything else

This repository is deliberately small. **Build only what has been explicitly
asked for.** Do not add screens, routes, components, dependencies, or "useful"
scaffolding on your own initiative. If something seems missing, say so and let
the user decide.

What exists today is the whole of it:

- a sign-in screen
- a welcome page
- an API client and session state

There is **no** router, no charting library, no toast system, no test setup,
and only four shadcn components (`button`, `card`, `input`, `label`). Their
absence is intentional. Do not add them uninvited.

**Every change updates `TESTING.md`**, which lives one level up at the
workspace root, outside both repositories. Add how to interact with the change,
how to test it, and how to verify it works — to §5 for a new capability, or by
deleting the relevant section when something is removed. This is part of the
change, not a follow-up task. Never put real credentials in it; tell the reader
to create their own account.

---

## 1. What this repository is

The React SPA for **OP Compass**. The Django API is a **separate repository**
(`opcompass-backend`, a sibling directory) with its own git history. They are
never merged; they agree only on the HTTP contract.

---

## 2. Stack

| Choice | Reason |
|---|---|
| **Vite + React SPA** | Builds to static files. No Node process in production, so deployment is one small nginx container. |
| **TypeScript** | `npm run build` is the type check; it is the gate that matters. |
| **Tailwind 4 + shadcn/ui** | Components are copied into the repo, not imported from a package. You own them and can edit them. |
| **No router** | Two screens. `App.tsx` renders one or the other based on whether there is a user. |

---

## 3. Layout

```
src/
  components/ui/   shadcn-generated: button, card, input, label
  lib/
    api.ts         The ONLY module that calls fetch
    auth.tsx       AuthProvider + useAuth
    utils.ts       cn() — shadcn's class merger
  pages/
    LoginPage.tsx
    WelcomePage.tsx
  App.tsx          AuthProvider + loading gate + which-screen logic
  main.tsx
  index.css        Tailwind import and design tokens
nginx/
  default.conf
  security-headers.conf
```

The `@/` alias maps to `src/` and is configured in **three** places that must
stay in sync: `vite.config.ts`, `tsconfig.json`, and `tsconfig.app.json`.

`baseUrl` is deliberately absent — TypeScript 6 deprecates it and the build
fails with `TS5101`. **Do not add it back.**

---

## 4. Talking to the API

`src/lib/api.ts` is the single HTTP client. **Nothing else calls `fetch`.**

```ts
import { api } from "@/lib/api"

const data = await api.get<Welcome>("/welcome/")
```

Paths are relative to `VITE_API_BASE_URL`, which defaults to `/api/v1`. That
relative default is intentional: the bundle calls whatever origin served it —
the Vite proxy in development, nginx in production. No hostname is compiled in.

Failures throw `ApiError`, carrying `status`.

### Backend contract

| Method | Path | Returns |
|---|---|---|
| `POST` | `/auth/login/` | `{access, user}` + sets the refresh cookie |
| `POST` | `/auth/refresh/` | No body — reads the cookie, rotates it. → `{access}` |
| `POST` | `/auth/logout/` | Revokes the token and clears the cookie. → `204` |
| `GET` | `/auth/me/` | The current user |
| `GET` | `/welcome/` | `{message, user}` |

Login is by **email**, not username — the backend's `USERNAME_FIELD` is email,
so the request body key is `email`.

---

## 5. Session handling — the rules

**Do not weaken any of this.**

- The **access token** lives in a module-scoped variable in `api.ts`. It must
  **never** be written to `localStorage` or `sessionStorage` — anything that can
  run a script on the page can read those.
- The **refresh token** is an `HttpOnly` cookie. This code cannot see it and
  should never try to. `document.cookie` does not contain it.
- Every request uses `credentials: "include"` so the cookie is attached.
- A `401` triggers **one** refresh attempt, shared across concurrent callers via
  `refreshInFlight`, then replays the original request once.
- Auth endpoints pass `skipAuthRetry: true` so a failed refresh cannot recurse.

**`refreshInFlight` is load-bearing, not an optimisation.** The backend rotates
refresh tokens — each one is single-use, and the old one is blacklisted the
moment it is exchanged. Two simultaneous refreshes would mean the second
presents a token the first just retired, and it gets a 401. The single-flight
promise is what stops that, including under StrictMode's double effect
invocation in development. Verified: one refresh per page load, not two. Do not
remove it.

This does not cover two browser *tabs* refreshing at the same instant, which can
still race. Not worth solving until someone hits it.

**Session restore on reload.** `AuthProvider` calls `refreshSession()` on mount;
if the cookie is still valid the user stays signed in across a page reload.
`isLoading` covers that window so an authenticated user is never flashed the
login screen. The `cancelled` flag in that effect exists because StrictMode
double-invokes effects in development — keep it.

`logout()` calls `POST /auth/logout/`, which blacklists the token server-side
and clears the cookie, then clears local state in a `finally` so the user is
never left on a signed-in screen after asking to leave. Signing out is real
revocation, not just a client-side discard.

---

## 6. Conventions

**Pages** — default-exported components in `src/pages/`.

**Styling** — Tailwind utilities and the semantic tokens (`bg-background`,
`text-muted-foreground`, `border-border`). Avoid raw hex outside `index.css`.

**Errors** — catch `ApiError` and inspect `.status`. Never show a raw server
message to an operations user.

**Auth copy** — login failures stay generic. Do not distinguish "unknown email"
from "wrong password"; that tells an attacker which emails are real accounts.

**Charts, when they arrive** — `index.css` ships the shadcn Nova preset's
`--chart-1..5`, which is a **grayscale ramp** and cannot distinguish one series
from another. It must be replaced with real hues, validated for
colour-vision-deficiency separation and contrast, before the first chart ships.

---

## 7. Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npx shadcn@latest add <component>
```

The shadcn CLI takes `-b <base>` and `-p <preset>`; this project was
initialised with `-b radix -p nova`. There is no `--base-color` flag any more.

---

## 8. Docker

Two-stage: `node:24-alpine` builds the bundle, `nginx:1.29-alpine` serves it.
No Node at runtime.

Security headers live in **`nginx/security-headers.conf`** and are pulled in
with `include`. This is not stylistic. nginx inherits `add_header` from an
enclosing block **only if the current block declares no `add_header` of its
own** — so `location /` and `location /assets/`, which both set
`Cache-Control`, would silently drop every security header without the include.
**Any new `location` block that sets an `add_header` must also include that
file.** Both configs are copied in the Dockerfile; a third config file means a
third `COPY`.

Both repositories attach to an external network named `opcompass`
(`docker network create opcompass`). Backend first, then frontend.

---

## 9. Gotchas

- **`VITE_` variables are compile-time**, inlined into the bundle. Changing one
  requires a rebuild, and nothing secret may go in one.
- **Do not add `baseUrl` to tsconfig.** TypeScript 6 errors with `TS5101`.
- **Use `import.meta.dirname`, not `__dirname`,** in `vite.config.ts` — Vite 8's
  native config loader warns on the latter.
- **Healthchecks must use `127.0.0.1`, not `localhost`.** The container resolves
  `localhost` to `::1` as well, and nginx listens on IPv4 only.
- **nginx `add_header` replaces, it does not merge.** See §8. Verify with
  `curl -I http://localhost/`.
- **The dev proxy is what makes development simple.** Calling
  `http://127.0.0.1:8000` directly from the browser makes CORS your problem, and
  the refresh cookie becomes cross-origin.
- **Every fetch needs `credentials: "include"`**, or the refresh cookie is not
  sent and session restore silently stops working.
- **`components/ui/` is generated.** Re-running `shadcn add` for an existing
  component overwrites local edits.
