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
| `?<field>=<a>,<b>,<c>` | **Multi-select.** Comma-separated values are OR'd — an `__in` lookup | ❌ |

**Multi-value filters are the one wire change.** Every filter in the UI is now a
checkbox menu: `?status=ACTIVE,ON_LEAVE,SUSPENDED` must return rows matching any
of the three, and separate parameters still AND together
(`?status=ACTIVE,ON_LEAVE&employment_type=FULL_TIME` = those statuses *and* that
type).

django-filter's `filterset_fields` shorthand generates exact-match filters, which
silently return **zero rows** for a comma-separated value rather than erroring —
the same quiet failure as an unlisted `ordering` field. Each filter needs an
explicit `BaseInFilter`:

```python
class EmploymentFilter(django_filters.FilterSet):
    status = django_filters.BaseInFilter(field_name="status", lookup_expr="in")
    employment_type = django_filters.BaseInFilter(field_name="employment_type", lookup_expr="in")
```

A single value behaves identically to the old exact match, so nothing else has
to change at the same time.

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
| search | name, code, **parent name**, **manager name**, **cost center** | `name`, `code` | ❌ add three |
| ordering | `code`, `name`, **`type`**, **`parent_name`**, **`manager_name`**, **`cost_center`**, **`headcount`** | `name`, `code`, `created_at` | ❌ add five |

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
| `GET` | `/attendance/` | `AttendanceSummary` — see §4.6 | ❌ not built |

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
| `/org-units/` | `name`, `code`, `type`, `parent\|null`, `legal_entity\|null`, `cost_center`, `manager_employment\|null`³ |
| `/job-titles/` | `name`, `code`, `job_family`, `description` |
| `/locations/` | `name`, `type`, `country`, `timezone` |
| `/legal-entities/` | `name`, `tax_id`, `country`, `currency`, `timezone` |
| `/users/` | `email`, `person\|null`, `status`, `auth_provider`, `is_staff`, `password`² |

¹ `national_id` is **write-only** and sent only when typed, so a blank field on
edit keeps the stored value. It must never appear in a response.
² `password` is **write-only** and omitted on edit unless deliberately changed.
³ `lead_employment` → **rename to `manager_employment`**, and treat it as the
single source of the reporting hierarchy. See §5 for what that replaces.

The field itself is already writable and returned: `org/serializers.py:71` has
it in `fields` and absent from `read_only_fields`, alongside the derived
`lead_name` (→ `manager_name`). The model is `org/models.py:92`, a nullable FK
to `people.Employment`, `on_delete=SET_NULL`, `related_name="led_org_units"`.

**None of its validation exists server-side.** Three rules the mock enforces and
Django does not — all ❌:

| Rule | Message the UI expects |
|---|---|
| The manager must be a **direct** member of the unit | `"W-1019 is not a member of Sales. A unit's manager must sit in it, not in one of its sub-units."` |
| A terminated employment cannot manage a unit | `"A terminated employment cannot manage a unit."` |
| A unit being created has no members, so it cannot be given a manager | `"A new unit has no members yet. Create it, assign someone to a position in it, then set the manager."` |

Direct membership, not the subtree: a territory rep must never be able to manage
Sales. The company node holds nobody and therefore has no manager, which is what
makes C-Level the top of the chain.

The rule is checked **only when the value changes**, so an employment that
transfers out does not retro-invalidate the unit and block unrelated edits. If
the backend enforces it on every save instead, renaming a unit whose manager has
since moved will start failing — match this behaviour.

**Delete behaviour diverges.** `EmploymentViewSet.protect_if` guards only
`position_assignments`, so Django lets you delete an employment that manages a
unit and lets the FK fall to `SET_NULL` — the unit silently loses its manager
*and everyone under it silently reparents to the level above*. The mock refuses
(*"This employment manages an org unit. Give that unit a new manager first."*).
With reporting derived from this field, the mock's behaviour is the safe one.

`employment.status` is **not** in the create body — every employment starts at
`ONBOARDING` and moves only through §4.3.

### 4.3 Actions

| Method | Path | Body | Effect | Status |
|---|---|---|---|---|
| `POST` | `/position-assignments/` | `{employment, position, is_primary: true, effective_from, change_reason}` | Assigns a seat; the position flips to `FILLED`. **No manager is sent** — see §5 | ⚠️ body changed |
| `POST` | `/employments/{id}/change-status/` | `{to_status, effective_from, reason}` | Walks the lifecycle, writes an `EmploymentStatusChange` | ✅ |
| `POST` | `/users/{id}/set-status/` | `{status, reason}` | Changes account status, writes an audit event | ✅ |

---

## 4.4 The reporting hierarchy — **breaking change from the current API**

The frontend now derives every reporting line from **one field**,
`org_unit.manager_employment`. There is no per-person manager.

> Your manager is the manager of your org unit. If that is you, it is the
> manager of the nearest unit above yours.

| | Today's API | What the frontend now needs |
|---|---|---|
| Source of truth | `position_assignment.manager_employment` per person | `org_unit.manager_employment` per unit |
| `Employment.manager` | Read from the open assignment | **Derived** by walking the tree |
| `DirectoryEntry.manager_name` | Same | **Derived** |
| `PositionAssignment` | Carries `manager_employment` / `manager_name` | **Both removed** |
| Reporting-cycle validation | `clean()` walks the manager chain | **Delete it.** The org tree is acyclic, so cycles cannot occur |

`position_assignment.manager_employment` should be **dropped** — not merely
ignored. Leaving it writable invites two sources of truth, which is the exact
problem this removes. Note the DB constraint and cycle check in
`people/models.py` go with it.

Deriving it server-side is a recursive walk up `org_unit.parent`; on Postgres a
recursive CTE, or a cached `manager_employment_id` denormalised onto the
employment and refreshed when a unit's manager or a person's position changes.
The frontend does not care which, as long as `Employment.manager` and
`DirectoryEntry.manager_name` keep their current shape.

**Why this matters beyond tidiness:** the same field is what
`ApproverType.ORG_UNIT_LEAD` resolves to (§7.4) and what an `ORG_UNIT`-scoped
role grant already means. One field feeds reporting, approvals and visibility.

## 4.5 The employment status enum — **changed**

`PREBOARDING` is **removed** and `TRAINING` is **added**, so the enum is now:

`ONBOARDING`, `TRAINING`, `PROBATION`, `ACTIVE`, `ON_LEAVE`, `SUSPENDED`,
`OFFBOARDING`, `TERMINATED`

Note this differs from spec §5.0 in two ways. The spec's **enum** omits
`TRAINING` even though its own state diagram includes it — the diagram is the
one that was right. And `PREBOARDING` is gone: the frontend creates employments
directly in `ONBOARDING`, so nothing occupies the pre-day-one state, and leaving
it in the enum meant every new hire opened a status dialog whose only option was
named after the state they were trying to leave.

Transitions the frontend expects `allowed_transitions` to return:

| From | To |
|---|---|
| `ONBOARDING` | `TRAINING`, `TERMINATED` |
| `TRAINING` | `PROBATION`, `TERMINATED` |
| `PROBATION` | `ACTIVE`, `TERMINATED` |
| `ACTIVE` | `ON_LEAVE`, `SUSPENDED`, `OFFBOARDING` |
| `ON_LEAVE` | `ACTIVE`, `OFFBOARDING` |
| `SUSPENDED` | `ACTIVE`, `TERMINATED` |
| `OFFBOARDING` | `TERMINATED` |
| `TERMINATED` | — |

The early exits to `TERMINATED` from `ONBOARDING` and `TRAINING`, and
`ON_LEAVE → OFFBOARDING`, are wider than the spec's diagram — without them
someone who quits in week one can only be recorded as having passed through
states they were never in.

Backend work: `ALLOWED_STATUS_TRANSITIONS` in `people/`, the `status` choices,
and a data migration for any row still in `PREBOARDING`. `verify_spec_rules`
asserts the old `PREBOARDING → ACTIVE` rejection and will need updating.

## 4.6 Attendance — **a new endpoint, nothing exists yet**

Backs the Attendance screen. Spec §5.5 is unbuilt, so this is entirely new
work: no model, no viewset, no data.

```
GET /attendance/?from=2026-07-19&to=2026-08-18&search=molina&org_unit=<id>,<id>
```

| Parameter | Meaning |
|---|---|
| `from`, `to` | Inclusive window, `YYYY-MM-DD`. **Required in practice** — the client always sends both, because Day / Week / Month are computed browser-side and there is no server notion of "this week" |
| `search` | Person's display name or employee code |
| `org_unit` | Multi-value ids, exact match on the unit the person currently sits in — **not** the subtree. The picker lists every unit, so a department and its teams is two ticks |

Not paginated: the response is the whole window as a flat list of people. The
shape is `AttendanceSummary` in `src/lib/types.ts` — `people`, each with one
`AttendanceDay` per date.

**The stored record** is one row per incident, not per day:

| Field | Notes |
|---|---|
| `employment` | FK |
| `date` | The working day it belongs to |
| `type` | `LATE_ARRIVAL` \| `EARLY_LEAVE` \| `ABSENCE` |
| `minutes` | One of the six steps — `15`, `30`, `60`, `120`, `180`, `240` — and **null for `ABSENCE`**. Time is not tracked to the exact minute: the server rounds **up** to the next step on write, so 0–15 stores 15, 16–30 stores 30, and anything above 180 stores 240. The bracket (`M15`, `M30`, `H1`, `H2`, `H3`, `H4`) is **derived** from it, never stored |
| `justification` | `UNEXCUSED` \| `EXCUSED` \| `JUSTIFIED`, on all three types |
| `reason` | Free text, shown in the tooltip |

Four rules the serializer has to honour, each already implemented in the mock:

1. **A day takes the worst justification of its incidents.** Two incidents on
   one day are one coloured bar and two tooltip lines.
2. **`AttendanceDay.absent` is a separate flag**, true when any of that day's
   incidents is an `ABSENCE`. The UI draws it as a half-height bar rather than a
   colour, because justification owns the hue.
3. **`FUTURE` is decided first**: a date after today is `FUTURE` even on a
   Saturday.
4. **A day with any record is a working day**, whatever the calendar says. Only
   an empty day falls back to `OFF` for a weekend or a public holiday. This is
   what makes weekend work — agents paying hours back on a Saturday — visible
   instead of discarded.
5. **`holiday` names the public holiday on that date**, whether or not it was
   worked, so a red bar on Thanksgiving can say so. The mock computes the eleven
   **US federal holidays** with the observance shift (Saturday → the Friday
   before, Sunday → the Monday after). The real implementation should read
   `calendar_day`, which exists but has no data
   (`backend-status-report.md` §3.5) — that is also what makes it work outside
   the US.

**There is no attendance percentage** in the response or the UI. It was removed
on purpose: worked hours are the backing measure and are not surfaced on this
screen, so a second "clean days ÷ worked days" figure would compete with it.
`AttendanceRow.attendance_pct` and `totals.attendance_pct` are both gone.

Non-working days come from the calendar; the mock hardcodes weekends. The real
implementation should read `calendar_day`, which exists but has no data
(`backend-status-report.md` §3.5).

### Writing them: `/attendance-records/`

The same rows as a plain CRUD collection, which the editing dialog uses.

| Method | Path | Body |
|---|---|---|
| `GET` | `/attendance-records/` | filters: `employment`, `date`, `type`, `justification` |
| `POST` | `/attendance-records/` | `employment`, `date`, `type`, `minutes\|null`, `justification`, `reason` |
| `PATCH` | `/attendance-records/{id}/` | the same |
| `DELETE` | `/attendance-records/{id}/` | — |

Validation the UI has error paths for, all ❌ server-side:

| Rule | Field | Message |
|---|---|---|
| One of each type per day | `type` | "That is already recorded for this day. Edit it instead." |
| An absence cannot sit beside a partial incident | `type` | "This day already has a late arrival or early leave recorded…" |
| …and vice versa | `type` | "This day is already recorded as a full-day absence." |
| A partial incident needs a duration | `minutes` | "Enter how many minutes." |
| Minutes below a full day | `minutes` | "That is a whole day. Record an absence instead." |
| Inside the employment's dates | `date` | "Before this employment started on 2024-03-04." |

`minutes` must be **null** for `ABSENCE` and a positive number otherwise. The
form offers only the six steps, and the server snaps whatever it receives up to
the next one, so the rule holds for any caller rather than depending on the
form. The bracket itself is never sent.

## 4.7 Appraisals — **new endpoints, nothing exists yet**

Two unrelated things share the Appraisals screen because they are both "what the
company gives back": a bonus that recurs on a schedule, and one-off prize draws.

### The six-month tenure bonus: `GET /tenure/`

**The schedule is derived, never stored.** Milestone `n` falls on
`hire_date + 6n months`, so correcting somebody's start date moves their whole
schedule with it and nothing has to be back-filled. The only rows in the
database are the payments.

Month arithmetic clamps to the end of the landing month: hired on 31 August,
the milestone lands on 28 February, not on 3 March. Getting this wrong walks
the anniversary forward a day every leap year.

One row per current employment (`status != TERMINATED`), paginated like every
other list.

| Field | Notes |
|---|---|
| `employment`, `employee_code`, `name`, `org_unit_name` | The person |
| `hire_date` | What the whole schedule is computed from |
| `months_of_service` | Whole months, for the "6 y 6 m" reading |
| `milestones_reached` | How many have fallen due on or before today |
| `milestones_paid` | How many of those have a payment recorded |
| `outstanding` | `reached - paid`. The number the screen actually acts on |
| `bonus_status` | `DUE` when `outstanding > 0`, else `UP_TO_DATE`. Filterable |
| `next_due` | Date of the next milestone not yet reached |
| `milestones[]` | Every reached milestone plus the next one: `milestone`, `due_date`, `reached`, `paid`, `bonus_id`, `paid_on`, `amount`, `note` |

`search` matches name or employee code; `bonus_status` and `status` filter.

Embedding `milestones[]` in the list response is deliberate — the dialog needs
the whole history and would otherwise be a second request per person. Ten years
of service is twenty-one small objects, which is cheaper than the round trip.

### Recording payments: `/tenure-bonuses/`

`GET` (filter by `employment`), `POST`, `DELETE`. No `PATCH` — an incorrect
bonus is deleted and re-recorded, so there is no partial-update path to guard.

| Field | Notes |
|---|---|
| `employment` | FK |
| `milestone` | Integer ≥ 1. `1` is six months, `2` is a year |
| `paid_on` | `YYYY-MM-DD`, the day it was actually handed over — **not** the due date |
| `amount` | Decimal string, nullable: not every bonus is cash |
| `note` | Free text |

| Rule | Field | Message |
|---|---|---|
| Cannot pay a milestone nobody has reached | `milestone` | "Not reached yet — that one falls due on 2026-09-16." |
| One payment per milestone | `milestone` | "That bonus is already recorded." |

**The schedule is the authority, not the form.** The reached check belongs on
the server: the client computes nothing about which milestones exist.

### Raffles: `/raffles/` and `/raffle-entries/`

A raffle is an event — `name`, `date`, `description` (the rules and the prize).
Full CRUD. The list adds two rollups so the table need not fetch every entry:

| Field | Notes |
|---|---|
| `participant_count` | Rows in `/raffle-entries/` for this raffle |
| `total_tickets` | Their tickets summed — the denominator for everyone's odds |

**`DELETE /raffles/{id}/` deletes its entries too.** An entry has no meaning
without the draw it belongs to, so orphans are not left behind.

Participants vary from one raffle to the next, which is the whole point of the
feature, so they are their own collection rather than a list on the raffle.

| Field | Notes |
|---|---|
| `raffle`, `employment` | FKs. `GET` filters on either |
| `tickets` | Integer ≥ 1. How many entries this person holds |
| `employee_code`, `person_name`, `org_unit_name` | Denormalised for the table |

| Rule | Field | Message |
|---|---|---|
| One row per person per raffle | `employment` | "They are already in this raffle. Edit their tickets instead." |
| A leaver cannot be entered | `employment` | "That employment has ended." |
| At least one ticket | `tickets` | "At least one ticket." |
| Sanity cap at 1000 | `tickets` | "That is more tickets than any draw needs." |

**Tickets are a count on one row, not one row per ticket.** Five tickets is
`tickets: 5`; five rows would make changing the number a hunt.

## 5. Invariants the UI is built to surface

Each of these has a visible error path in the app. If the server stops enforcing
one, the UI shows nothing and the data silently rots.

| Rule | Where it surfaces | Status |
|---|---|---|
| `employee_code`, user email, org unit `code`, job title `code` are unique | Field error in the create/edit dialog | ✅ |
| Delete is refused while other records depend on the row, with a prose reason in `errors.detail` | The delete dialog stays open and shows it | ✅ |
| One open primary assignment per employment; no overlapping assignments | Field error on `effective_from` | ✅ |
| No org-unit cycles | Field error on `parent` | ✅ — and now the *only* cycle rule, since reporting follows this tree |
| Lifecycle transitions follow the state machine below | `allowed_transitions` drives the dropdown; an illegal move is a field error naming the legal ones | ⚠️ the machine itself changed — see below |
| `allowed_transitions` on every `Employment` | The *Change status* menu item is hidden when it is empty | ✅ |
| Assigning someone flips the position to `FILLED`; vacating returns it to `OPEN` | The vacancy count on the dashboard | ✅ |
| An org unit's manager must be one of its own **direct** members, and not terminated | Field error on `manager_employment`; the dropdown only offers direct members | ⚠️ enforced by the mock; unverified against Django — see §4.2 note 3 |
| An employment that manages a unit cannot be deleted | Refusal in the delete dialog | ⚠️ mock only; Django would `SET_NULL` and silently reparent the unit's people |
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
| **Approver resolution for `ORG_UNIT_LEAD`** | The unit lead's only planned consumer. `ApproverType.ORG_UNIT_LEAD` exists (`approvals/models.py:20`) and spec §4.2 routes steps through it, but nothing resolves it to a user (`approvals/views.py:87`). Until it lands, the lead is a label; after it, the lead approves their unit's requests |
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
