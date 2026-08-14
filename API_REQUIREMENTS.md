# API requirements — what the frontend needs from `opcompass-backend`

**Everything the React app depends on, endpoint by endpoint, with what the
backend already provides and what it does not.**

Last verified: **2026-08-14**, against `opcompass-backend@main` (read from
`config/settings.py`, `core/pagination.py`, `accounts/views.py`,
`people/views.py`, `org/views.py`, `core/views.py`).

This file lives in the frontend repo because the frontend is what generates the
requirement: a screen needs a field, so the API has to serve it. It must be
updated **in the same commit** as any change to a screen's data needs. The
backend's own view of its state is `backend-status-report.md` at the workspace
root; where the two disagree, re-read the code — that report is already stale on
at least one point (it says there is no org-chart endpoint; `/org-units/tree/`
exists and is exercised by `verify_spec_rules`).

**Status legend**

| | Meaning |
|---|---|
| ✅ | Implemented and the frontend uses it today |
| ⚠️ | Partly implemented — works, but not for every field the UI sends |
| ❌ | Not implemented; the frontend degrades or the feature is inert |
| 🔭 | Not needed yet, recorded so it is not rediscovered later |

---

## 1. Conventions

| Item | Contract | Status |
|---|---|---|
| Base path | `/api/v1/` — the frontend's `VITE_API_BASE_URL`, relative so the bundle calls whatever origin served it | ✅ |
| Auth header | `Authorization: Bearer <access>` on every request except the auth endpoints | ✅ |
| Credentials | Every request is sent with `credentials: "include"` so the refresh cookie is attached | ✅ |
| Trailing slashes | **Required** on every path. The frontend always sends them | ✅ |
| Content type | `application/json` both ways | ✅ |
| Empty responses | `204` with no body for `DELETE` and `logout` | ✅ |

### Error envelope

Every failure returns the same four keys, plus `errors` on validation:

```json
{ "detail": "...", "code": "validation_error", "status": 400,
  "errors": { "employee_code": ["An employment with this code already exists."] } }
```

| Requirement | Why the UI needs it | Status |
|---|---|---|
| `errors` keyed by **field name**, values are arrays of strings | `FormDialog` puts each message next to its input. A single banner is a regression | ✅ |
| `errors.detail` for non-field refusals | `ConfirmDelete` and `FormDialog` show this as one sentence. It must read as prose — "Positions use this job title." — not a code | ✅ |
| `code` is machine-readable | The UI prefers `code` over string-matching `detail` | ✅ |
| Never HTML, even with `DEBUG=true` | An unmatched `/api/` path returning Django's debug page breaks the client's JSON parse | ✅ |

### Status codes the UI branches on

| Code | UI behaviour |
|---|---|
| `401` | One refresh attempt, then replay; on failure, sign out |
| `403` | "You do not have permission to view this." on lists; on login, the server's own message is shown |
| `400` | Field errors into the form; dialog stays open |
| `404` | Not-found page or an inline error |
| `5xx` | "The server had a problem." |

---

## 2. Authentication and session

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| `POST` | `/auth/login/` | `{email, password}` | `{access, user}` + sets the refresh cookie | ✅ |
| `POST` | `/auth/refresh/` | *no body* — reads the cookie | `{access}` | ✅ |
| `POST` | `/auth/logout/` | — | `204`, revokes server-side | ✅ |
| `GET` | `/auth/me/` | — | The `user` object below | ✅ |

Login is by **email**; the request body key is `email`, not `username`.

`user` shape (`src/lib/auth.tsx`):

```ts
{ id, email, person: string | null, person_name: string | null, status,
  auth_provider, mfa_enabled, is_staff, is_superuser,
  roles: { code, scope_type, scope_id }[], permissions: string[],
  last_login_at: string | null }
```

Hard requirements, all currently met:

| Requirement | Status |
|---|---|
| Refresh token is an **HttpOnly** cookie, path-scoped to `/api/v1/auth/`. The frontend never sees it and must never be asked to store one | ✅ |
| Refresh rotates and blacklists, so a stolen cookie dies on next use | ✅ |
| `401` on login for both a wrong password **and** an unknown email — identical message, or it becomes an account-enumeration oracle | ✅ |
| `403` on login when credentials are right but `status != ACTIVE`, with a message naming the reason | ✅ |
| `user.status` re-checked on refresh, so suspending someone signed in ends their session | ✅ |
| `permissions` is a flat code list, or `["*"]` for a superuser | ✅ |

---

## 3. The list contract

Every collection endpoint is paginated, searchable, orderable and filterable.
This section is the one that matters most — §3.3 is where the real gaps are.

### 3.1 Pagination

| Item | Contract | Status |
|---|---|---|
| Envelope | `{count, next, previous, results}` | ✅ |
| `?page=` | 1-based | ✅ |
| `?page_size=` | Honoured per request | ✅ |
| Default | `50` server-side. The UI always sends an explicit size, so this only matters for other clients | ✅ |
| **Maximum** | **200.** The UI relies on this for option lists — see §7.1 | ✅ |

The tables request `page_size=10` by default, with 20 / 50 / 100 offered.

### 3.2 Search, ordering, filtering

| Parameter | Contract | Status |
|---|---|---|
| `?search=` | Case-insensitive substring, OR across the collection's search fields | ✅ |
| `?ordering=field` / `?ordering=-field` | Single field, `-` for descending | ✅ |
| `?<field>=<value>` | Exact match, for the fields the collection declares | ✅ |

All three backends are wired globally in `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS`
(`DjangoFilterBackend`, `SearchFilter`, `OrderingFilter`). What is missing is
per-viewset **coverage**: the frontend sorts and searches on more fields than the
viewsets declare, and DRF silently ignores an unknown `ordering` value rather
than erroring — so a column looks sortable and simply does nothing.

> **The silent-failure warning.** An unlisted `ordering_fields` entry is ignored
> without a 400. Any column added to a table must be added to `ordering_fields`
> in the same change, or it ships as a dead control.

### 3.3 Per-collection coverage

"Sends" is what the frontend puts on the wire today (see `mock_data/routes.ts`,
which is the executable copy of this table). ORM paths are suggestions.

#### `/people/` — `PersonViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `gender` | `national_id_country`, `gender` | ✅ |
| search | name, email, **phone** | `first_name`, `last_name`, `preferred_name`, `personal_email` | ❌ add `personal_phone` |
| ordering | **`display_name`** (the default), **`personal_email`**, **`personal_phone`** | `last_name`, `first_name`, `created_at` | ❌ add three |

`display_name` is computed (`preferred_name or first_name` + `last_name`) — see
§3.4.

#### `/employments/` — `EmploymentViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `status`, `employment_type` | `status`, `employment_type`, `work_mode`, `legal_entity` | ✅ |
| search | code, work email, person name, **entity name** | `employee_code`, `work_email`, `person__first_name`, `person__last_name` | ❌ add `legal_entity__name`, `person__preferred_name` |
| ordering | `hire_date`, `status`, **`person_detail.display_name`**, **`current_position.job_title`**, **`manager.name`** | `hire_date`, `employee_code`, `status` | ❌ add three |

`person__preferred_name` is already in `DirectoryViewSet.search_fields` but not
here — the two should match.

#### `/directory/` — `DirectoryViewSet` (read-only)

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `status`, `employment_type`, `work_mode` | same, plus `legal_entity` | ✅ |
| search | name, code, work email, **job title**, **org unit** | code, work email, person names | ❌ add the position joins |
| ordering | `name`, `employee_code`, **`job_title`**, **`org_unit`**, **`manager_name`**, **`location`**, **`status`** | `employee_code`, `hire_date` | ❌ add six |

#### `/positions/` — `PositionViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `status`, `seniority` | `status`, `seniority`, `org_unit`, `job_title`, `location`, `is_people_manager` | ✅ |
| search | job title, org unit, **location**, **occupant name / code** | `job_title__name`, `org_unit__name` | ❌ add `location__name` and the occupant join |
| ordering | `seniority`, `status`, **`job_title_name`**, **`org_unit_name`**, **`location_name`**, **`occupant.name`**, **`salary_band_min`** | `seniority`, `status`, `created_at` | ❌ add five |

Occupant is the open `PositionAssignment` → `Employment` → `Person`. Sorting and
searching it needs that join annotated, not a Python-side sort.

#### `/org-units/` — `OrgUnitViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `type` | `type`, `parent`, `legal_entity`, `is_active` | ✅ |
| search | name, code, **parent name**, **lead name**, **cost center** | `name`, `code` | ❌ add three |
| ordering | `code`, `name`, **`type`**, **`parent_name`**, **`lead_name`**, **`cost_center`**, **`headcount`** | `name`, `code`, `created_at` | ❌ add five |

`headcount` is a count of open assignments in the unit — needs an annotation to
be sortable.

#### `/job-titles/` — `JobTitleViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `job_family` | `job_family`, `is_active` | ✅ |
| search | name, code, **job family**, **description** | `name`, `code` | ❌ add two |
| ordering | `name`, **`code`**, **`job_family`** | `name`, `created_at` | ❌ add two |

#### `/locations/` — `LocationViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `type` | `type`, `country`, `is_active` | ✅ |
| search | name, **country**, **timezone** | `name` | ❌ add two |
| ordering | `name`, `country`, **`type`**, **`timezone`** | `name`, `country`, `created_at` | ❌ add two |

#### `/legal-entities/` — `LegalEntityViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | *(none from the UI)* | `country`, `is_active` | ✅ |
| search | name, tax id, **country** | `name`, `tax_id` | ❌ add `country` |
| ordering | `name`, `country`, **`tax_id`**, **`currency`**, **`timezone`** | `name`, `country`, `created_at` | ❌ add three |

#### `/users/` — `UserViewSet`

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `status`, `auth_provider` | `status`, `auth_provider`, `is_staff` | ✅ |
| search | email, person name | `email`, `person__first_name`, `person__last_name` | ✅ |
| ordering | `email`, **`person_name`**, **`status`**, **`can_sign_in`**, **`auth_provider`**, **`last_login_at`** | `email`, `date_joined` | ❌ add five |

`can_sign_in` is derived from `status`; ordering by it can map to `status`.

#### `/audit-events/` — `AuditEventViewSet` (read-only)

| | Frontend sends | Backend has | Gap |
|---|---|---|---|
| filters | `subject_type` | `action`, `subject_type`, `subject_id`, `actor_user` | ✅ |
| search | action, subject type, **actor email**, **subject id** | `action`, `subject_type` | ❌ add two |
| ordering | `-occurred_at`, **`action`**, **`subject_type`**, **`actor_email`**, **`ip`** | `occurred_at` | ❌ add four |

### 3.4 Ordering keys for computed and nested fields — **decision needed**

The frontend sends the **serializer path** it renders: `person_detail.display_name`,
`occupant.name`, `manager.name`, `current_position.job_title`, `job_title_name`.
DRF's `OrderingFilter` matches model/annotation names, so these do not resolve as
written. Two ways to close it:

1. **Backend accepts the serializer paths** via an alias map per viewset
   (`person_detail.display_name` → `person__last_name`, etc.), annotating where
   a real sort key does not exist. The frontend stays unchanged and each
   column's key is obvious from the column.
2. **Backend publishes its own keys** and the frontend switches to them.

**Recommended: (1).** The mapping belongs where the serializer is defined, and
it keeps one vocabulary — what the API returns is what you order by. Whichever
is chosen, **`ClaudeGuide.md` §5h and `mock_data/routes.ts` must be updated to
match**, because the mock currently implements (1).

Sort semantics the mock assumes, worth matching so mock and real behave alike:

- Nulls last ascending, first descending (Postgres's default).
- Numeric-looking strings (salary bands, `fte_pct`) sort numerically, not as text.

---

## 4. Endpoint reference

Response shapes are `src/lib/types.ts`; that file is the authoritative list of
fields the UI reads. Request bodies below are exactly what each screen sends.

### 4.1 Read-only endpoints

| Method | Path | Returns | Status |
|---|---|---|---|
| `GET` | `/directory/` | `Paginated<DirectoryEntry>` — flattened non-terminated employments | ✅ |
| `GET` | `/headcount/` | `{total, by_status, by_employment_type, by_work_mode, by_org_unit[], open_positions}` | ✅ |
| `GET` | `/org-units/tree/` | `OrgUnitNode[]` — nested, roots first, **not paginated** | ✅ |
| `GET` | `/audit-events/` | `Paginated<AuditEvent>` | ✅ |

`by_org_unit` entries are `{position__org_unit__name, position__org_unit_id, headcount}`
— the ORM alias is load-bearing in `DashboardPage`; renaming it breaks the chart.

### 4.2 Collections with full CRUD

All follow `GET /x/`, `POST /x/`, `PATCH /x/{id}/`, `DELETE /x/{id}/`. ✅ for all
eight.

| Path | `POST`/`PATCH` body |
|---|---|
| `/people/` | `first_name`, `last_name`, `preferred_name`, `national_id_country`, `birth_date\|null`, `gender`, `personal_email`, `personal_phone`, `emergency_contact: [{name, relation, phone}]`, `national_id`¹ |
| `/employments/` | `person`, `legal_entity`, `employee_code`, `employment_type`, `work_mode`, `hire_date`, `probation_end_date\|null`, `work_email`, `timezone` |
| `/positions/` | `job_title`, `org_unit`, `location\|null`, `seniority`, `status`, `is_people_manager`, `salary_band_min\|null`, `salary_band_max\|null`, `currency`, `headcount` (number) |
| `/org-units/` | `name`, `code`, `type`, `parent\|null`, `legal_entity\|null`, `cost_center` |
| `/job-titles/` | `name`, `code`, `job_family`, `description` |
| `/locations/` | `name`, `type`, `country`, `timezone` |
| `/legal-entities/` | `name`, `tax_id`, `country`, `currency`, `timezone` |
| `/users/` | `email`, `person\|null`, `status`, `auth_provider`, `is_staff`, `password`² |

¹ `national_id` is **write-only** and sent only when typed, so a blank field on
edit keeps the stored value. It must never appear in a response.
² `password` is **write-only** and omitted on edit unless deliberately changed.

`employment.status` is **not** in the create body — every employment starts at
`PREBOARDING` and moves only through §4.3.

### 4.3 Actions

| Method | Path | Body | Effect | Status |
|---|---|---|---|---|
| `POST` | `/position-assignments/` | `{employment, position, manager_employment\|null, is_primary: true, effective_from, change_reason}` | Assigns a seat; the position flips to `FILLED` | ✅ |
| `POST` | `/employments/{id}/change-status/` | `{to_status, effective_from, reason}` | Walks the lifecycle, writes an `EmploymentStatusChange` | ✅ |
| `POST` | `/users/{id}/set-status/` | `{status, reason}` | Changes account status, writes an audit event | ✅ |

---

## 5. Invariants the UI is built to surface

Each of these has a visible error path in the app. If the server stops enforcing
one, the UI shows nothing and the data silently rots.

| Rule | Where it surfaces | Status |
|---|---|---|
| `employee_code`, user email, org unit `code`, job title `code` are unique | Field error in the create/edit dialog | ✅ |
| Delete is refused while other records depend on the row, with a prose reason in `errors.detail` | The delete dialog stays open and shows it | ✅ |
| One open primary assignment per employment; no overlapping assignments | Field error on `effective_from` | ✅ |
| No reporting cycles | Field error on `manager_employment` | ✅ |
| No org-unit cycles | Field error on `parent` | ✅ |
| Lifecycle transitions follow spec §5.0 only | `allowed_transitions` drives the dropdown; an illegal move is a field error naming the legal ones | ✅ |
| `allowed_transitions` on every `Employment` | The *Change status* menu item is hidden when it is empty | ✅ |
| Assigning someone flips the position to `FILLED`; vacating returns it to `OPEN` | The vacancy count on the dashboard | ✅ |
| A user cannot delete or suspend their own account | Those menu items are hidden, and the server refuses anyway | ✅ |
| Password rules are returned as field errors on `password` | The password field | ✅ |

---

## 6. Permissions

`user.permissions` is served and the frontend uses it **for presentation only** —
hiding controls the user cannot use. The server re-checks every request; the
frontend is never the gate.

| Item | Status |
|---|---|
| Flat permission codes on `/auth/me/`, `["*"]` for superusers | ✅ |
| Scoping applied to every list endpoint | ⚠️ applied to employments, directory, headcount and two org viewsets; `PersonViewSet` is unscoped — see `backend-status-report.md` §3.4 |
| `SELF` / `REPORTS` scope types for the §8 `EMPLOYEE` and `TEAM_LEAD` roles | ❌ not expressible today |

The mock backend does **not** model permissions at all, so none of this can be
tested against `npm run dev` — it needs the real API.

---

## 7. Outstanding work

Ordered by what unblocks the most visible behaviour.

### 7.1 Option lists are capped at 200 records — ❌

Six screens fetch an unpaged list to fill a dropdown: "Reports to" and "Person"
on Employments, "Parent unit" on Org units, job title / org unit / location on
Positions, "Person" on Users. Each sends `page_size=200`, which is the server's
`max_page_size`.

**This breaks silently at 201 records** — the dropdown simply stops offering
some rows, with no error. Two screens have the same problem for their filter
options, which are derived client-side from that capped list: **Job titles →
Family** and **Audit log → Subject**.

Needed, roughly in order of how soon:

- A **distinct-values** endpoint or parameter, so filter dropdowns stop reading
  whole collections: `GET /job-titles/families/` and
  `GET /audit-events/subject-types/`, or a generic `?distinct=<field>`.
- A **typeahead lookup** on the referenced collections — `?search=` plus a small
  page is already enough, but the selects need to become async first. That is a
  frontend change this file exists to trigger; do not raise `max_page_size` as a
  workaround.

### 7.2 Sorting and searching coverage — ❌

Everything in §3.3 marked ❌. Roughly 30 `ordering_fields` entries and 15
`search_fields` entries across nine viewsets, plus annotations for `headcount`,
`occupant`, `display_name` and `manager`. Settle §3.4 first — the ordering key
vocabulary decides how the rest is written.

Until this lands, **the affected column headers are inert against the real API**
while working perfectly against the mock. That gap between the two is the most
likely thing to be mistaken for a frontend bug.

### 7.3 Consistency fixes — ⚠️

- `person__preferred_name` is searchable on `/directory/` but not `/employments/`.
- `/legal-entities/` and `/locations/` do not filter on `currency` / `timezone`,
  which the mock offers.

### 7.4 Recorded, not yet needed — 🔭

| Item | When it matters |
|---|---|
| `?as_of=<date>` on directory and assignments | The spec's effective-dated history; no screen reads it yet |
| Bulk team move | Reorganisations; no UI for it |
| Gap detection between consecutive assignments | Overlap is checked, gaps are not (`backend-status-report.md` §3.5) |
| `org_unit_membership` materialised view | Only §5.4 entity not built |
| Notifications, file upload/download, the approval runtime | Whole modules; nothing in the frontend touches them yet |
| PII isolation for `national_id` (encryption, read auditing, retention) | Write-only is honoured today, the rest is a documented gap |

---

## 8. Keeping this file honest

- `src/lib/types.ts` is the authoritative response shape. This file describes
  behaviour; that file describes data.
- `mock_data/routes.ts` is the **executable** copy of §3.3 — the mock declares
  the same search and filter fields per collection. When they disagree, the mock
  is what the frontend was actually built against.
- Adding a sortable column, a filter or a screen means updating §3.3 here,
  `mock_data/routes.ts`, and the backend viewset. Miss the third and the control
  ships dead.
- Re-verify the ✅ marks against the backend before trusting them; they are a
  snapshot of one reading of the code, not a test result. The backend's
  `verify_spec_rules`, `verify_access_control` and `verify_crud` commands are
  the real check for §5.
