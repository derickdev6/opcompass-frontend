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

The build follows `internal-ops-platform-spec.md` at the workspace root.
**Implemented so far: the Core layer (§4) and Directory/Org management (§5.4).**

**`API_REQUIREMENTS.md`** tracks everything this app needs from the backend and
what is still missing there. Anything that depends on the API starts by reading
it.

What exists today is the whole of it:

- a sign-in screen
- an app shell with a retractable side panel
- Dashboard, Directory, People, Employments, Org chart, Org units, Positions,
  Job titles, Locations, Legal entities, Users, Audit log
- create / edit / delete on every entity above, plus position assignment and
  the employment lifecycle transition
- server-side search, filter, sort and pagination on every list screen — see §5h
- a mock backend in `mock_data/`, so development needs no API — see §4a

There is **no** charting library and **no** test setup. Their absence is
intentional. Do not add them uninvited.

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
| **react-router** | Eight screens now need their own URLs. nginx already falls back to `index.html`, so deep links work. |
| **`useApi`, not a query library** | No cache, no deduplication, no retry. Add TanStack Query when the app actually needs one, not before. |
| **Bar lists, not a chart library** | The dashboard's breakdowns are a handful of categories each; a `<div>` with a width reads better than a pie and costs no dependency. |

---

## 3. Layout

```
src/
  components/
    ui/            shadcn-generated (avatar, badge, button, card, dropdown-menu,
                   input, label, select, separator, skeleton, sonner, table, tooltip)
    AppShell.tsx   Sidebar + header + <Outlet/>
    Sidebar.tsx    The retractable panel — see §5d
    ModuleSection.tsx  One module's block on the dashboard — see §5e
    ErrorBoundary.tsx  Catches render crashes — see §5f
    PageHeader.tsx Title / description / actions
    DataState.tsx  LoadingRows, ErrorState, EmptyState
    StatusBadge.tsx Employment and position status pills
    list/          Search, filters, sortable heads, pagination — see §5h
  lib/
    api.ts         The ONLY module that calls fetch
    auth.tsx       AuthProvider + useAuth
    useApi.ts      Fetch hook with loading/error state
    useListParams.ts Search / filter / sort / page state — see §5h
    useDebounced.ts Search-box debounce
    types.ts       API response shapes
    utils.ts       cn() — shadcn's class merger
  pages/           One file per screen
  App.tsx          Router + auth gate
  index.css        Tailwind import and design tokens
mock_data/        The stand-in backend — see §4a
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

List endpoints are paginated: `{count, next, previous, results}` — the
`Paginated<T>` type in `lib/api.ts`. Build query strings with `query({...})`,
which drops empty values.

### Backend contract

**`API_REQUIREMENTS.md` is the full contract** — every endpoint, every request
body, every search / filter / ordering field, and what the backend does and does
not implement yet. Read it before assuming an endpoint exists, and **update it in
the same commit** whenever a screen's data needs change. The table below is the
summary; that file is the detail.

| Method | Path | Returns |
|---|---|---|
| `POST` | `/auth/login/` | `{access, user}` + sets the refresh cookie |
| `POST` | `/auth/refresh/` | No body — reads the cookie, rotates it. → `{access}` |
| `POST` | `/auth/logout/` | Revokes the token and clears the cookie. → `204` |
| `GET` | `/auth/me/` | Current user, with `roles` and flat `permissions` |
| `GET` | `/directory/` | Flattened active employments — the directory read model |
| `GET` | `/employments/` | Full employment records |
| `GET` | `/headcount/` | Totals by status, type, mode, org unit + open positions |
| `GET` | `/org-units/tree/` | The org chart, nested |
| `GET` | `/positions/` | Seats, with occupant and salary band |
| `GET` | `/audit-events/` | The append-only change log |

Login is by **email**, not username — the backend's `USERNAME_FIELD` is email,
so the request body key is `email`.

`user.permissions` is a flat list of codes (`["person.view", …]`, or `["*"]`
for a superuser). Use it to hide controls the user cannot use — **presentation
only**. The server re-checks every request; never treat it as the gate.

---

## 4a. The mock backend

**`npm run dev` needs no Django and no database.** `mock_data/` answers every
call inside the browser tab, seeded with WinitLaw — one legal entity, 16 people,
and the real org tree (C-Level, Management, Operations → Collections/CX/QA/IT,
Sales → NY/CA/NC/NJ). Full detail is in **`mock_data/README.md`**; the parts
that matter when working here:

- **The switch is `VITE_USE_MOCK_API`.** Unset means on in `dev`, off in
  `build`. Set it to `true` or `false` to force either. `VITE_MOCK_LATENCY_MS`
  and `VITE_MOCK_AUTO_SIGN_IN` tune the rest.
- **The seam is one function**, `transport()` in `api.ts`. It is imported
  dynamically, so a production build with mocks off drops the folder entirely —
  and `mockFetch` returns a real `Response`, so the error envelope, the 401
  refresh-and-retry and the 204 handling are not duplicated anywhere.
- **`api.ts` is still the only module in `src/` that dispatches a request.**
  That rule did not move.
- **Rows are stored normalised and responses are derived**, like the real
  serializers. A write therefore lands everywhere: assign someone to a position
  and the directory, the unit's filled count and the dashboard all move.
- **Every serializer returns a type from `lib/types.ts`,** so `npm run build`
  catches fixture drift. Change a response shape and the compiler names the line
  in `mock_data/serializers.ts` that no longer fills it in.
- **Adding a screen means adding its endpoint here too**, or the screen has
  nothing to read. New collection → a `Collection` in `routes.ts` plus rows in
  `seed.ts`; anything that is not plain CRUD gets a branch in `route()`.

Two things it deliberately does **not** model, so do not test them against it:
**permissions** (served as seeded, never enforced) and **session security**
(there is no `HttpOnly` cookie to imitate, and faking one would mean writing
something script-readable — see §5). Both need the real backend.

The mock is not persistence: the store is module memory, so F5 re-seeds it.

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

## 5d. The sidebar

`components/Sidebar.tsx`. Two states, driven by one boolean held in `AppShell`
and persisted to `localStorage` under `opcompass.sidebar.collapsed` (a UI
preference, not a credential — unlike tokens, this belongs there).

| State | Width | Shows |
|---|---|---|
| Expanded | `w-60` (240px) | Icon + label, section headings |
| Collapsed | `w-16` (64px) | Icon only (`size-5`), label as `sr-only` + a hover tooltip |

Items are `w-full` in both states, inset only by the list's `px-2`. Collapsed,
that makes each tile the full 64px strip less an 8px margin, with the icon
centred — not a small square floating in a wider panel.

The label stays in the DOM as `sr-only` when collapsed, so screen-reader users
never lose the link text. `overflow-hidden` on the `<aside>` stops labels
spilling into the content area while the width animates.

> **Do not give `NavLink` a `className` callback here.** Collapsed, the link is
> wrapped in `<TooltipTrigger asChild>`, and Radix's `Slot` merges `className`
> by string-joining: `[slotProps.className, childProps.className].join(" ")`. A
> function is stringified into the `class` attribute, so **every style on the
> link silently disappears** — no error, no warning, just an unstyled anchor in
> collapsed mode only. `SidebarLink` therefore resolves the active state with
> `useMatch` and passes a plain string. The same trap applies to any child of an
> `asChild` trigger.

Adding a nav item means adding one entry to `SECTIONS` and one `<Route>` in
`App.tsx`.

> **Testing note.** In a browser pane that is not compositing frames, CSS
> transitions never advance, so `getComputedStyle` returns the pre-transition
> width and the sidebar looks stuck one toggle behind. Set
> `element.style.transition = 'none'` before measuring. This wasted a
> debugging cycle once already — it is a harness artifact, not a bug.

## 5e. The dashboard is grouped by module

`DashboardPage` is a stack of `<ModuleSection>` blocks, **one per module**. Each
carries the module's name, a spec reference tag (`§5`), an icon, a one-line
description, and a rule under the heading. That heading and rule are the visual
division: a reader can tell at a glance which module a number belongs to, which
starts mattering the moment there is more than one.

Only **People** exists today. When Assets, Finance or any other module lands:

```tsx
<ModuleSection name="Assets" reference="§6" icon={Laptop} description="…">
  {/* that module's cards */}
</ModuleSection>
```

Add the block; change nothing else. **Do not** put a module's numbers outside
its section, and do not flatten the sections back into one grid — the grouping
is the point.

Each section fetches its own data and owns its loading and error state, so one
module's API being down does not blank the whole dashboard.

## 5f. Error pages

One component, `pages/ErrorPage.tsx`, backs every full-page failure, so they
all look the same and the wording lives in one place. `NotFoundPage` and
`ForbiddenPage` are thin wrappers.

- **404** — the catch-all `<Route path="*">` inside the shell. A mistyped URL
  shows the 404 rather than bouncing to the dashboard, which would hide broken
  links.
- **500** — `components/ErrorBoundary.tsx` wraps the whole app and catches
  render-time crashes, so a bug in one screen shows an error page instead of a
  blank white document. Still a class component: React has no hook equivalent
  of `componentDidCatch`. The technical detail block renders **only** in dev.
- **Inline errors** — `DataState.tsx` handles a failed fetch inside a screen.
  A whole-page error for one broken table is too blunt.

`ApiError` carries `status`, `code` and per-field `errors` parsed from the
API's envelope. Prefer `code` over string-matching the message.

**Login messages are asymmetric on purpose** (`messageFor` in `LoginPage`): a
`403` shows the server's reason, because the account is suspended or disabled
and the caller already proved they own it. A `401` stays vague — confirming an
email exists would tell an attacker which addresses are real accounts. Do not
"improve" the 401 message.

## 5g. CRUD screens

Every editing screen is built from the same four pieces, so adding one is
mostly wiring:

| Piece | Job |
|---|---|
| `lib/useCrud.ts` | Dialog state (`create` / `edit` / `delete`) and the POST / PATCH / DELETE calls |
| `form/CrudDialogs.tsx` | Renders the create, edit and delete dialogs for one collection |
| `form/FormDialog.tsx` | Modal form; maps the API's `errors` envelope onto the fields |
| `form/Field.tsx` | `TextField`, `TextAreaField`, `SelectField`, `CheckboxField`, `FieldRow` |

The shape of a screen:

```tsx
const { data, reload } = useApi<Paginated<T>>("/things/…")
const crud = useCrud<T>("/things", reload)
const [form, setForm] = useState(EMPTY)

useEffect(() => {                       // seed the form when a dialog opens
  if (crud.editing) setForm({ …crud.editing })
  else if (crud.isCreating) setForm(EMPTY)
}, [crud.editing, crud.isCreating])
```

Rules worth keeping:

- **Create and edit share one form.** A new field cannot be added to one and
  forgotten in the other.
- **Server errors land on fields.** Never replace that with a single banner —
  `FormDialog` only shows a banner when there are no field-level messages.
- **The dialog stays open on failure**, including delete: the server refuses to
  delete rows other records depend on, and that refusal has to stay visible.
- **`SelectField` uses a `__none__` sentinel** because Radix Select cannot hold
  an empty string. It is translated back to `""` on the way out.
- **Write-only fields start blank on edit.** `Person.national_id` is never
  returned by the API, and the password field is omitted unless typed — so
  saving an unrelated field does not wipe either.

**Not built:** no optimistic updates, no cache, no bulk actions, no inline
editing. Each save refetches the list. That is fine at this size.

## 5h. List screens: search, filter, sort, page

**All four are server-side.** Sorting a column sorts the whole collection, not
the ten rows on screen. Nothing filters or slices an array in the browser, and
nothing should start to — the moment it does, page 2 becomes a lie.

| Piece | Job |
|---|---|
| `lib/useListParams.ts` | Holds the state and builds `queryString` |
| `list/ListToolbar.tsx` | The row of controls above the table |
| `list/SearchInput.tsx` | The search box (debounced inside the hook) |
| `list/FilterSelect.tsx` | One dropdown, always with an "all" entry first |
| `list/SortableHead.tsx` | A `<TableHead>` that sorts, with `aria-sort` |
| `list/Pagination.tsx` | Range, rows-per-page and the two page buttons |

The shape of a screen:

```tsx
const params = useListParams({ ordering: "name", filters: { status: ALL } })
const { data, reload } = useApi<Paginated<T>>(`/things/${params.queryString}`)
…
<ListToolbar>
  <SearchInput value={params.search} onChange={params.setSearch} label="Search things" />
  <FilterSelect label="Status" value={params.filters.status}
    onChange={(v) => params.setFilter("status", v)} options={enumOptions(STATUSES)} />
</ListToolbar>
…
<SortableHead field="name" {...params.sort}>Name</SortableHead>
…
<Pagination page={params.page} pageSize={params.pageSize} count={data?.count ?? 0}
  noun="thing" onPageChange={params.setPage} onPageSizeChange={params.setPageSize} />
```

Rules worth keeping:

- **Default 10 rows**, with 20 / 50 / 100 offered. `PAGE_SIZES` in the hook is
  the only place that list exists.
- **Every setter resets to page 1.** Landing on page 4 of a one-page result is
  the classic bug here, and it is why the setters are not plain `useState`.
- **`ALL` is the "no filter" sentinel**, because Radix Select cannot hold an
  empty string — the same reason `SelectField` has `__none__`. It is dropped
  from the query string rather than sent.
- **`field` on `SortableHead` is the API's ordering key, not the label.** Nested
  keys work: `person_detail.display_name`, `occupant.name`.
- **A dropdown's options never come from the paged list.** "Reports to" on
  Employments and "Parent unit" on Org units each fetch their own unpaged copy,
  or the table's pagination would silently decide who can be a manager. When a
  screen does this, its `useCrud` reload must refresh **both**.

### What the API has to support

Every collection endpoint takes `?search=`, `?ordering=` (`-` prefix for
descending), `?page=` and `?page_size=`, plus exact-match filters on the
serialised field of the same name — DRF's `SearchFilter`, `OrderingFilter` and
`filterset_fields`. The filters each screen sends are listed in
`mock_data/routes.ts` next to that collection. **Adding a filter to a screen
means adding it there too**, and on the real backend, or it is silently ignored.

**Much of this is not implemented on the backend yet** — see
`API_REQUIREMENTS.md` §3.3 for the field-by-field gap. DRF ignores an unknown
`ordering` value without erroring, so those columns work against the mock and do
nothing against Django. Do not debug that as a frontend bug.

`max_page_size` is **200**, which is also the ceiling on the unpaged option
lists above. They break silently past 200 records — `API_REQUIREMENTS.md` §7.1.

## 6. Conventions

**Pages** — default-exported components in `src/pages/`.

**List screens** — every one handles four states via `components/DataState.tsx`:
loading, error, empty, and populated. A screen that renders an empty table on a
failed request is a bug; `useApi` surfaces the error so that cannot happen
silently.

**Tables stay narrow.** A column earns its place by being something you scan or
compare across rows. Everything else belongs in the edit dialog, which already
holds the full record — People shows no legal name, Employments no code, entity
or type. A field dropped from a table is still **searchable**: the API's
`search` covers more fields than any table displays, so removing a column costs
nothing but the horizontal space it was taking. Resist adding one back "just so
it is visible somewhere".

**Status pills** — `StatusBadge`. Colour is never the only signal; the label is
always rendered, so a colour-blind reader loses nothing.

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
- **`npm run dev` uses the mock backend by default,** so a change that looks
  broken against Django may not have reached it. `VITE_USE_MOCK_API=false` in
  `.env.local` turns it off — see §4a. The console logs `[mock]` on start-up
  whenever it is on.
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
