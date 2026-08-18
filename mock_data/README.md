# mock_data — the stand-in backend

The app runs with **no Django and no database**. Everything under `/api/v1` is
answered inside the browser tab by the modules in this folder.

```bash
npm run dev
```

That is the whole setup. You land on the dashboard already signed in, with a
sample company behind it: **WinitLaw**, one legal entity in New York, 19 people
across C-Level, Management, Operations (Collections, CX, QA, IT) and Sales
(NY, CA, NC, NJ).

```
Winit                      —            nobody sits here; a visual root
└── C-Level                Ricardo      approvals stop here
    └── Management         Renata
        ├── Operations     Javier
        │   ├── Collections  Andrés
        │   ├── CX           Lucía
        │   ├── QA           Paula
        │   └── IT           —          falls through to Javier
        └── Sales          Camila
            └── NY · CA · NC · NJ  —    all fall through to Camila
```

**Reporting lines are derived from that column and nothing else.** There is no
per-person manager field — see `managerOf` in `serializers.ts`.

The org deliberately covers every shape a unit can take, because these are what
break a chart:

| Shape | In the seed |
|---|---|
| Manager at the top of the unit they run | Javier Montoya, in Operations |
| Department-level member who manages nobody | Carolina Duarte, Operations Coordinator |
| Deputy at department level, reporting to its manager | Sofía Delgado, Sales Team Lead |
| Unit with no manager, so its people report a level up | IT, and all four sales territories |
| Unit with no members and therefore no manager | Winit, the company node |
| Department of one | Management |

---

## Switching it off

| `VITE_USE_MOCK_API` | Effect |
|---|---|
| unset | **On** in `npm run dev`, **off** in `npm run build` |
| `true` | On, including in a production build |
| `false` | Off — requests go to Django through the Vite proxy |

Put the override in `.env.local`. `VITE_` variables are compile-time, so
changing one needs a restart of the dev server, not just a reload.

Two more knobs:

| Variable | Default | What it does |
|---|---|---|
| `VITE_MOCK_LATENCY_MS` | `180` | Artificial delay per request, so loading skeletons actually render. `0` for instant. |
| `VITE_MOCK_AUTO_SIGN_IN` | `true` | Start with a live session. Set to `false` to land on the login screen instead. |

When mocks are off, the dynamic import in `api.ts` is dead code and Rollup drops
this whole folder from the bundle — a production build ships none of it.

---

## Signing in

Auto sign-in puts you in as `admin@winitlaw.com`, a superuser. After **Sign
out**, or with `VITE_MOCK_AUTO_SIGN_IN=false`, any seeded account works with the
password `mockpass`:

| Account | Shows you |
|---|---|
| `admin@winitlaw.com` | Superuser, `permissions: ["*"]` |
| `mariana.vargas@winitlaw.com` | HR admin, a scoped permission list |
| `javier.montoya@winitlaw.com` | Manager, scoped to Operations |
| `camila.restrepo@winitlaw.com` | Manager, scoped to Sales |
| `andres.quintero@winitlaw.com` | `PENDING` — refused, with the reason |
| `gabriel.ocampo@winitlaw.com` | `DISABLED` — refused, with the reason |

These are fake accounts against a fake backend that exists only in your tab.
They are not credentials, and nothing here reaches a server. **A real
deployment still needs a real account** — see `TESTING.md` §2.

---

## Layout

| File | What it holds |
|---|---|
| `seed.ts` | **The sample data.** Start here to add or change records. |
| `rows.ts` | The row shapes — the "tables". |
| `db.ts` | The mutable store, id generation, the audit-log append. |
| `serializers.ts` | Rows → API response shapes, mirroring the DRF serializers. |
| `routes.ts` | The endpoints, and the rules behind them. |
| `index.ts` | `mockFetch()`, which `api.ts` calls in place of `fetch`. |

`api.ts` remains the only module in `src/` that dispatches a request. `mockFetch`
returns a real `Response`, so the error envelope, the 401 refresh-and-retry and
the 204 handling all run unchanged — there is no second code path in the app.

Rows are stored **normalised** and the response shapes are derived, the same way
the backend does it. That is what makes a write show up everywhere it should:
assign someone to a position and the directory, the org unit's filled count, the
position's occupant and the dashboard all move together.

Every serializer returns a type from `src/lib/types.ts`, so `npm run build` is
what keeps the fixtures honest — change the frontend's view of the API and the
compiler points at the line here that no longer fills it in.

---

## What is simulated

- Login, refresh, logout, `/auth/me/`, including the 401-then-refresh retry
- Every list endpoint with `search`, `ordering` (`-` prefix for descending,
  dotted paths for nested fields), `page`, `page_size`, and filters on the
  serialised field of the same name — the stand-in for DRF's `SearchFilter`,
  `OrderingFilter` and `filterset_fields`. Filters are **multi-value**:
  `?status=ACTIVE,ON_LEAVE` keeps rows matching either, and separate parameters
  AND together. Which fields each collection accepts is declared next to its
  `list` in `routes.ts`
- Create, edit and delete on all eight collections
- The derived endpoints: `/directory/`, `/headcount/`, `/org-units/tree/`
- Position assignment, and the employment lifecycle: `ONBOARDING → TRAINING →
  PROBATION → ACTIVE`, then `ON_LEAVE` / `SUSPENDED` / `OFFBOARDING` /
  `TERMINATED`. `TRANSITIONS` in `serializers.ts` is the whole state machine
- The invariants the dialogs are built to surface: unique codes, protected
  deletes, no overlapping assignments, no org-unit cycles, a unit's manager
  being one of its own direct members, and transitions that have to be walked
  in order
- Audit events, appended on every write
- Attendance: `/attendance/?from=&to=` returns one day-strip per person grouped
  by org unit. The incidents themselves are **generated**, not written out —
  `attendanceFor()` in `seed.ts` derives them from a hash of employment id and
  date, so they are stable across reloads but a month of them costs no file

## What is not

- **Permissions.** `user.permissions` is served as seeded and no endpoint checks
  it. Role and scope behaviour has to be tested against the real backend.
- **Persistence.** The store lives in module memory. A page reload re-seeds it,
  so anything you create is gone after F5. Client-side navigation keeps it.
- **Soft deletes.** The real API hides rows and keeps them; this one removes
  them. The refusal-when-referenced behaviour is the part that matters to the
  UI, and that is reproduced.
- **Token security.** There is no cookie to imitate — the real refresh token is
  `HttpOnly`, and faking it would mean writing something script-readable, which
  is exactly what `api.ts` promises never to do. The mock session is a module
  variable and dies with the tab. **This is the one place the mock is not a
  faithful model**, so session handling still has to be verified against the
  real backend (`TESTING.md` §5.1).

---

## Adding data

Add rows to `seed.ts`. Ids are readable strings (`emp-15`, `pos-17`), not
UUIDs — deliberately, because they show up in the console and in error messages.
Keep the references pointing at rows that exist; nothing validates the seed at
load time, and a dangling id surfaces as a `—` in a table.

To add an endpoint, add a `Collection` in `routes.ts` and register it in
`COLLECTIONS`. Anything that is not plain CRUD gets its own branch in `route()`,
next to `/headcount/` and `/org-units/tree/`.
