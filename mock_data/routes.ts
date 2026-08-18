/**
 * The endpoints, and the rules behind them.
 *
 * This is a deliberately thin imitation of the Django API: the same paths, the
 * same envelopes, and the handful of invariants from spec §5.4 that the UI is
 * built to surface — unique codes, protected deletes, no overlapping
 * assignments, no reporting cycles, and a lifecycle that has to be walked in
 * order. Without those the error paths in every dialog are dead code and drift
 * unnoticed.
 *
 * What it is not: an authorisation layer. `user.permissions` is served as
 * seeded, and no endpoint checks it. Permission behaviour has to be tested
 * against the real backend.
 */

import type { Paginated } from "@/lib/api"

import {
  db,
  findById,
  nextId,
  openAssignmentFor,
  openAssignmentOn,
  recordEvent,
  removeById,
} from "./db"
import type {
  AttendanceEventRow,
  EmploymentRow,
  OrgUnitRow,
  PersonRow,
  UserRow,
} from "./rows"
import {
  TRANSITIONS,
  attendanceSummary,
  headcount,
  isCurrent,
  orgUnitTree,
  serializeAssignment,
  serializeDirectoryEntry,
  serializeEmployment,
  serializeOrgUnit,
  serializePerson,
  serializeIncident,
  serializePosition,
  serializeSessionUser,
  serializeUserAccount,
} from "./serializers"

export interface MockResult {
  status: number
  body: unknown
}

type Body = Record<string, unknown>

// ---------------------------------------------------------------------------
// Errors — the API's {detail, code, status, errors} envelope
// ---------------------------------------------------------------------------

class HttpError extends Error {
  status: number
  detail: string
  code: string
  errors: Record<string, string[]> | null

  constructor(
    status: number,
    detail: string,
    code = "error",
    errors: Record<string, string[]> | null = null,
  ) {
    super(detail)
    this.name = "HttpError"
    this.status = status
    this.detail = detail
    this.code = code
    this.errors = errors
  }
}

/**
 * Field-level messages, collected then thrown together so a form shows every
 * problem at once instead of one per round trip.
 */
class Invalid {
  private fields: Record<string, string[]> = {}

  add(field: string, message: string): void {
    this.fields[field] = [...(this.fields[field] ?? []), message]
  }

  require(data: Body, ...keys: string[]): void {
    for (const key of keys) {
      const value = data[key]
      if (value === undefined || value === null || value === "") {
        this.add(key, "This field is required.")
      }
    }
  }

  throwIfAny(): void {
    if (Object.keys(this.fields).length > 0) {
      throw new HttpError(400, "Invalid input.", "validation_error", this.fields)
    }
  }
}

/** A refusal the user sees as a sentence, not as a field message. */
function refuse(detail: string): HttpError {
  return new HttpError(400, detail, "protected", { detail: [detail] })
}

function notFound(): HttpError {
  return new HttpError(404, "Not found.", "not_found")
}

// ---------------------------------------------------------------------------
// Reading request bodies
// ---------------------------------------------------------------------------

function text(data: Body, key: string, fallback = ""): string {
  const value = data[key]
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") return String(value)
  return fallback
}

/** Absent keeps the current value; empty or null clears it. */
function optional(data: Body, key: string, current: string | null): string | null {
  if (!(key in data)) return current
  const value = data[key]
  if (value === null || value === undefined || value === "") return null
  return String(value).trim()
}

function flag(data: Body, key: string, current: boolean): boolean {
  const value = data[key]
  return typeof value === "boolean" ? value : current
}

function count(data: Body, key: string, current: number): number {
  const value = Number(data[key])
  return Number.isFinite(value) ? value : current
}

// ---------------------------------------------------------------------------
// List responses
// ---------------------------------------------------------------------------

/**
 * Read a field off a serialised object, following dots.
 *
 * Sorting and searching name fields as the API exposes them, and some of those
 * are nested — `person_detail.display_name` is how you sort employments by the
 * person's name.
 */
function valueAt(item: unknown, path: string): unknown {
  let current: unknown = item
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1
  if (b === null || b === undefined) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  // Numeric strings — salary bands, FTE — must not sort as text.
  const [na, nb] = [Number(a), Number(b)]
  if (Number.isFinite(na) && Number.isFinite(nb) && a !== "" && b !== "") {
    return na - nb
  }
  return String(a).localeCompare(String(b))
}

function sorted<T>(items: T[], ordering: string | null): T[] {
  if (!ordering) return items
  const descending = ordering.startsWith("-")
  const field = descending ? ordering.slice(1) : ordering
  return [...items].sort((a, b) => {
    const result = compare(valueAt(a, field), valueAt(b, field))
    return descending ? -result : result
  })
}

function matches(item: unknown, term: string, fields: string[]): boolean {
  const needle = term.toLowerCase()
  return fields.some((field) => {
    const value = valueAt(item, field)
    return typeof value === "string" && value.toLowerCase().includes(needle)
  })
}

/** DRF's page-number pagination, including the empty-page edge. */
function paginate<T>(items: T[], params: URLSearchParams): Paginated<T> {
  const size = Math.max(1, Number(params.get("page_size") ?? 50))
  const current = Math.max(1, Number(params.get("page") ?? 1))
  const start = (current - 1) * size
  return {
    count: items.length,
    next: start + size < items.length ? `?page=${current + 1}&page_size=${size}` : null,
    previous: current > 1 ? `?page=${current - 1}&page_size=${size}` : null,
    results: items.slice(start, start + size),
  }
}

interface ListOptions {
  /** Fields `?search=` looks in, substring and case-insensitive. */
  search?: string[]
  /**
   * Query parameters that filter on the serialised field of the same name.
   *
   * **Multi-value**: `?status=ACTIVE,ON_LEAVE` keeps rows matching either, an
   * `__in` lookup rather than an exact match. A single value behaves exactly
   * as an exact match would, so this stays backward compatible.
   */
  filters?: string[]
}

/** Serialise, then search, filter, order and page — in that order. */
function listOf<Row, Out>(
  rows: Row[],
  serialize: (row: Row) => Out,
  params: URLSearchParams,
  options: ListOptions = {},
): Paginated<Out> {
  let items = rows.map(serialize)

  const search = params.get("search")
  if (search && options.search?.length) {
    const fields = options.search
    items = items.filter((item) => matches(item, search, fields))
  }

  for (const field of options.filters ?? []) {
    const raw = params.get(field)
    if (raw) {
      const wanted = raw.split(",").filter(Boolean)
      items = items.filter((item) =>
        wanted.includes(String(valueAt(item, field) ?? "")),
      )
    }
  }

  return paginate(sorted(items, params.get("ordering")), params)
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

/**
 * There is no cookie to imitate — the real refresh token is HttpOnly and this
 * layer would have to write something readable to fake it, which is exactly
 * what `api.ts` promises never to do. So the session lives in this module
 * variable and dies with the tab, and start-up is handled by seeding it.
 */
let session: { userId: string; accessToken: string } | null = null

const AUTO_SIGN_IN = import.meta.env.VITE_MOCK_AUTO_SIGN_IN !== "false"

function issueToken(): string {
  return `mock-access-${Math.random().toString(36).slice(2)}`
}

if (AUTO_SIGN_IN) {
  const admin = db.users.find((user) => user.is_superuser)
  if (admin) session = { userId: admin.id, accessToken: issueToken() }
}

function currentUser(): UserRow {
  const user = findById(db.users, session?.userId ?? null)
  if (!user) throw new HttpError(401, "Not authenticated.", "not_authenticated")
  return user
}

function actorEmail(): string | null {
  return findById(db.users, session?.userId ?? null)?.email ?? null
}

function requireSession(authorization: string | null): void {
  if (!session || authorization !== `Bearer ${session.accessToken}`) {
    throw new HttpError(
      401,
      "Authentication credentials were not provided.",
      "not_authenticated",
    )
  }
}

const STATUS_REFUSALS: Record<string, string> = {
  PENDING: "This account has not been activated yet. Ask an administrator to activate it.",
  SUSPENDED: "This account is suspended. Contact an administrator.",
  DISABLED: "This account has been disabled.",
}

function authRoutes(method: string, segments: string[], data: Body): MockResult | null {
  if (segments[0] !== "auth") return null
  const action = segments[1]

  if (action === "login" && method === "POST") {
    const email = text(data, "email").toLowerCase()
    const password = text(data, "password")
    const user = db.users.find((row) => row.email.toLowerCase() === email)

    // Wrong password and unknown email answer identically on purpose: a
    // different response would confirm which addresses are real accounts.
    if (!user || user.password !== password) {
      throw new HttpError(
        401,
        "No active account found with the given credentials.",
        "authentication_failed",
      )
    }
    if (user.status !== "ACTIVE") {
      // Only reachable by someone who already proved they own the account, so
      // naming the reason is help rather than disclosure.
      throw new HttpError(
        403,
        STATUS_REFUSALS[user.status] ?? "This account cannot sign in.",
        "account_inactive",
      )
    }

    user.last_login_at = new Date().toISOString()
    session = { userId: user.id, accessToken: issueToken() }
    recordEvent(user.email, "auth.signed_in", "user", user.id)
    return {
      status: 200,
      body: { access: session.accessToken, user: serializeSessionUser(user) },
    }
  }

  if (action === "refresh" && method === "POST") {
    if (!session) {
      throw new HttpError(401, "Session expired.", "token_not_valid")
    }
    // Rotated on every use, like the real one.
    session = { ...session, accessToken: issueToken() }
    return { status: 200, body: { access: session.accessToken } }
  }

  if (action === "logout" && method === "POST") {
    session = null
    return { status: 204, body: null }
  }

  if (action === "me" && method === "GET") {
    return { status: 200, body: serializeSessionUser(currentUser()) }
  }

  throw notFound()
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

interface Collection {
  list: (params: URLSearchParams) => unknown
  create?: (data: Body) => unknown
  update?: (id: string, data: Body) => unknown
  remove?: (id: string) => void
}

const duplicate = (label: string) => `${label} already exists.`

function people(): Collection {
  const get = (id: string): PersonRow => {
    const row = findById(db.people, id)
    if (!row) throw notFound()
    return row
  }

  const write = (row: PersonRow, data: Body): void => {
    const invalid = new Invalid()
    invalid.require(data, "first_name", "last_name")
    invalid.throwIfAny()

    row.first_name = text(data, "first_name", row.first_name)
    row.last_name = text(data, "last_name", row.last_name)
    row.preferred_name = text(data, "preferred_name", row.preferred_name)
    row.national_id_country = text(data, "national_id_country", row.national_id_country)
    row.birth_date = optional(data, "birth_date", row.birth_date)
    row.gender = optional(data, "gender", row.gender)
    row.personal_email = text(data, "personal_email", row.personal_email)
    row.personal_phone = text(data, "personal_phone", row.personal_phone)
    // Write-only: kept when the field comes back blank, never serialised out.
    if (text(data, "national_id")) row.national_id = text(data, "national_id")
    if (Array.isArray(data.emergency_contact)) {
      row.emergency_contact = data.emergency_contact as PersonRow["emergency_contact"]
    }
  }

  return {
    list: (params) =>
      listOf(db.people, serializePerson, params, {
        search: ["display_name", "legal_name", "personal_email", "personal_phone"],
        filters: ["gender"],
      }),

    create: (data) => {
      const row: PersonRow = {
        id: nextId("p"),
        first_name: "",
        last_name: "",
        preferred_name: "",
        national_id: "",
        national_id_country: "",
        birth_date: null,
        gender: null,
        personal_email: "",
        personal_phone: "",
        pronouns: "",
        emergency_contact: [],
      }
      write(row, data)
      db.people.push(row)
      recordEvent(actorEmail(), "person.created", "person", row.id)
      return serializePerson(row)
    },

    update: (id, data) => {
      const row = get(id)
      write(row, data)
      recordEvent(actorEmail(), "person.updated", "person", row.id)
      return serializePerson(row)
    },

    remove: (id) => {
      const row = get(id)
      if (db.employments.some((employment) => employment.person === row.id)) {
        throw refuse("This person has an employment. Delete the employment first.")
      }
      if (db.users.some((user) => user.person === row.id)) {
        throw refuse("A user account is linked to this person. Unlink it first.")
      }
      removeById(db.people, row.id)
      recordEvent(actorEmail(), "person.deleted", "person", row.id)
    },
  }
}

function legalEntities(): Collection {
  return {
    list: (params) =>
      listOf(db.legalEntities, (row) => row, params, {
        search: ["name", "tax_id", "country"],
        filters: ["country", "currency"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      invalid.require(data, "name", "country")
      if (db.legalEntities.some((row) => row.name === text(data, "name"))) {
        invalid.add("name", duplicate("A legal entity with this name"))
      }
      invalid.throwIfAny()

      const row = {
        id: nextId("le"),
        name: text(data, "name"),
        tax_id: text(data, "tax_id"),
        country: text(data, "country"),
        currency: text(data, "currency", "USD"),
        timezone: text(data, "timezone", "UTC"),
        is_active: true,
      }
      db.legalEntities.push(row)
      recordEvent(actorEmail(), "legal_entity.created", "legal_entity", row.id)
      return row
    },

    update: (id, data) => {
      const row = findById(db.legalEntities, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      invalid.require(data, "name", "country")
      if (
        db.legalEntities.some(
          (other) => other.id !== row.id && other.name === text(data, "name"),
        )
      ) {
        invalid.add("name", duplicate("A legal entity with this name"))
      }
      invalid.throwIfAny()

      row.name = text(data, "name", row.name)
      row.tax_id = text(data, "tax_id", row.tax_id)
      row.country = text(data, "country", row.country)
      row.currency = text(data, "currency", row.currency)
      row.timezone = text(data, "timezone", row.timezone)
      recordEvent(actorEmail(), "legal_entity.updated", "legal_entity", row.id)
      return row
    },

    remove: (id) => {
      const row = findById(db.legalEntities, id)
      if (!row) throw notFound()
      if (db.employments.some((employment) => employment.legal_entity === row.id)) {
        throw refuse("Employments are attached to this legal entity.")
      }
      if (db.orgUnits.some((unit) => unit.legal_entity === row.id)) {
        throw refuse("Org units are attached to this legal entity.")
      }
      removeById(db.legalEntities, row.id)
      recordEvent(actorEmail(), "legal_entity.deleted", "legal_entity", row.id)
    },
  }
}

function locations(): Collection {
  return {
    list: (params) =>
      listOf(db.locations, (row) => row, params, {
        search: ["name", "country", "timezone"],
        filters: ["type", "country"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      invalid.require(data, "name", "country")
      if (db.locations.some((row) => row.name === text(data, "name"))) {
        invalid.add("name", duplicate("A location with this name"))
      }
      invalid.throwIfAny()

      const row = {
        id: nextId("loc"),
        name: text(data, "name"),
        type: text(data, "type", "OFFICE"),
        timezone: text(data, "timezone", "UTC"),
        country: text(data, "country"),
        is_active: true,
      }
      db.locations.push(row)
      recordEvent(actorEmail(), "location.created", "location", row.id)
      return row
    },

    update: (id, data) => {
      const row = findById(db.locations, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      invalid.require(data, "name", "country")
      if (
        db.locations.some(
          (other) => other.id !== row.id && other.name === text(data, "name"),
        )
      ) {
        invalid.add("name", duplicate("A location with this name"))
      }
      invalid.throwIfAny()

      row.name = text(data, "name", row.name)
      row.type = text(data, "type", row.type)
      row.timezone = text(data, "timezone", row.timezone)
      row.country = text(data, "country", row.country)
      recordEvent(actorEmail(), "location.updated", "location", row.id)
      return row
    },

    remove: (id) => {
      const row = findById(db.locations, id)
      if (!row) throw notFound()
      if (db.positions.some((position) => position.location === row.id)) {
        throw refuse("Positions are placed at this location.")
      }
      removeById(db.locations, row.id)
      recordEvent(actorEmail(), "location.deleted", "location", row.id)
    },
  }
}

function jobTitles(): Collection {
  return {
    list: (params) =>
      listOf(db.jobTitles, (row) => row, params, {
        search: ["name", "code", "job_family", "description"],
        filters: ["job_family"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      invalid.require(data, "name", "code")
      if (db.jobTitles.some((row) => row.code === text(data, "code"))) {
        invalid.add("code", duplicate("A job title with this code"))
      }
      invalid.throwIfAny()

      const row = {
        id: nextId("jt"),
        name: text(data, "name"),
        code: text(data, "code"),
        description: text(data, "description"),
        job_family: text(data, "job_family"),
        is_active: true,
      }
      db.jobTitles.push(row)
      recordEvent(actorEmail(), "job_title.created", "job_title", row.id)
      return row
    },

    update: (id, data) => {
      const row = findById(db.jobTitles, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      invalid.require(data, "name", "code")
      if (
        db.jobTitles.some(
          (other) => other.id !== row.id && other.code === text(data, "code"),
        )
      ) {
        invalid.add("code", duplicate("A job title with this code"))
      }
      invalid.throwIfAny()

      row.name = text(data, "name", row.name)
      row.code = text(data, "code", row.code)
      row.description = text(data, "description", row.description)
      row.job_family = text(data, "job_family", row.job_family)
      recordEvent(actorEmail(), "job_title.updated", "job_title", row.id)
      return row
    },

    remove: (id) => {
      const row = findById(db.jobTitles, id)
      if (!row) throw notFound()
      if (db.positions.some((position) => position.job_title === row.id)) {
        throw refuse("Positions use this job title.")
      }
      removeById(db.jobTitles, row.id)
      recordEvent(actorEmail(), "job_title.deleted", "job_title", row.id)
    },
  }
}

/** Walk up from `unitId`; true if `ancestorId` is on the way to the root. */
function hasAncestor(unitId: string, ancestorId: string): boolean {
  let current = findById(db.orgUnits, unitId)
  let guard = 0
  while (current?.parent && guard < 20) {
    if (current.parent === ancestorId) return true
    current = findById(db.orgUnits, current.parent)
    guard += 1
  }
  return false
}

/** Is this employment's current seat directly in `unitId`? */
function isDirectMember(employmentId: string, unitId: string): boolean {
  const assignment = openAssignmentFor(employmentId)
  const position = findById(db.positions, assignment?.position)
  return position?.org_unit === unitId
}

/**
 * The unit's manager must be a live, **direct** member of it.
 *
 * Direct on purpose: Sales is managed by someone sitting in Sales, never by a
 * rep in one of its territories. The company node holds nobody and therefore
 * has no manager, which is what makes C-Level the top of the chain.
 *
 * Only re-checked when it *changes*: a manager who has since transferred out
 * would otherwise block every unrelated edit to the unit, which is a worse
 * failure than a stale manager sitting visibly in the table until someone
 * fixes it.
 */
function checkManager(
  data: Body,
  invalid: Invalid,
  unit: OrgUnitRow | null,
): string | null {
  const current = unit?.manager_employment ?? null
  const manager = optional(data, "manager_employment", current)
  if (!manager || manager === current) return manager

  const employment = findById(db.employments, manager)
  if (!employment) {
    invalid.add("manager_employment", "That employment does not exist.")
  } else if (employment.status === "TERMINATED") {
    invalid.add("manager_employment", "A terminated employment cannot manage a unit.")
  } else if (!unit) {
    invalid.add(
      "manager_employment",
      "A new unit has no members yet. Create it, assign someone to a position in it, then set the manager.",
    )
  } else if (!isDirectMember(manager, unit.id)) {
    invalid.add(
      "manager_employment",
      `${employment.employee_code} is not a member of ${unit.name}. A unit's manager must sit in it, not in one of its sub-units.`,
    )
  }
  return manager
}

function orgUnits(): Collection {
  return {
    list: (params) =>
      listOf(db.orgUnits, serializeOrgUnit, params, {
        search: ["name", "code", "parent_name", "manager_name", "cost_center"],
        filters: ["type", "parent"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      invalid.require(data, "name", "code")
      if (db.orgUnits.some((row) => row.code === text(data, "code"))) {
        invalid.add("code", duplicate("An org unit with this code"))
      }
      const parent = optional(data, "parent", null)
      if (parent && !findById(db.orgUnits, parent)) {
        invalid.add("parent", "That org unit does not exist.")
      }
      const manager = checkManager(data, invalid, null)
      invalid.throwIfAny()

      const row = {
        id: nextId("ou"),
        parent,
        name: text(data, "name"),
        code: text(data, "code"),
        type: text(data, "type", "TEAM"),
        manager_employment: manager,
        cost_center: text(data, "cost_center"),
        legal_entity: optional(data, "legal_entity", null),
        is_active: true,
      }
      db.orgUnits.push(row)
      recordEvent(actorEmail(), "org_unit.created", "org_unit", row.id)
      return serializeOrgUnit(row)
    },

    update: (id, data) => {
      const row = findById(db.orgUnits, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      invalid.require(data, "name", "code")
      if (
        db.orgUnits.some(
          (other) => other.id !== row.id && other.code === text(data, "code"),
        )
      ) {
        invalid.add("code", duplicate("An org unit with this code"))
      }

      const parent = optional(data, "parent", row.parent)
      if (parent === row.id) {
        invalid.add("parent", "A unit cannot be its own parent.")
      } else if (parent && !findById(db.orgUnits, parent)) {
        invalid.add("parent", "That org unit does not exist.")
      } else if (parent && hasAncestor(parent, row.id)) {
        invalid.add("parent", "That unit is below this one; the tree would loop.")
      }
      const manager = checkManager(data, invalid, row)
      invalid.throwIfAny()

      row.manager_employment = manager
      row.parent = parent
      row.name = text(data, "name", row.name)
      row.code = text(data, "code", row.code)
      row.type = text(data, "type", row.type)
      row.cost_center = text(data, "cost_center", row.cost_center)
      row.legal_entity = optional(data, "legal_entity", row.legal_entity)
      recordEvent(actorEmail(), "org_unit.updated", "org_unit", row.id)
      return serializeOrgUnit(row)
    },

    remove: (id) => {
      const row = findById(db.orgUnits, id)
      if (!row) throw notFound()
      if (db.orgUnits.some((unit) => unit.parent === row.id)) {
        throw refuse("This unit has child units. Move or delete them first.")
      }
      if (db.positions.some((position) => position.org_unit === row.id)) {
        throw refuse("Positions live in this unit.")
      }
      removeById(db.orgUnits, row.id)
      recordEvent(actorEmail(), "org_unit.deleted", "org_unit", row.id)
    },
  }
}

function positions(): Collection {
  const validate = (data: Body, invalid: Invalid): void => {
    invalid.require(data, "job_title", "org_unit")
    if (text(data, "job_title") && !findById(db.jobTitles, text(data, "job_title"))) {
      invalid.add("job_title", "That job title does not exist.")
    }
    if (text(data, "org_unit") && !findById(db.orgUnits, text(data, "org_unit"))) {
      invalid.add("org_unit", "That org unit does not exist.")
    }
    const location = optional(data, "location", null)
    if (location && !findById(db.locations, location)) {
      invalid.add("location", "That location does not exist.")
    }
    const min = Number(data.salary_band_min)
    const max = Number(data.salary_band_max)
    if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
      invalid.add("salary_band_max", "The maximum cannot be below the minimum.")
    }
  }

  return {
    list: (params) =>
      listOf(db.positions, serializePosition, params, {
        search: [
          "job_title_name",
          "org_unit_name",
          "location_name",
          "occupant.name",
          "occupant.employee_code",
        ],
        filters: ["status", "seniority", "org_unit", "job_title"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      validate(data, invalid)
      invalid.throwIfAny()

      const row = {
        id: nextId("pos"),
        job_title: text(data, "job_title"),
        org_unit: text(data, "org_unit"),
        location: optional(data, "location", null),
        seniority: text(data, "seniority", "MID"),
        is_people_manager: flag(data, "is_people_manager", false),
        status: text(data, "status", "OPEN"),
        salary_band_min: optional(data, "salary_band_min", null),
        salary_band_max: optional(data, "salary_band_max", null),
        currency: text(data, "currency", "USD"),
        headcount: count(data, "headcount", 1),
      }
      db.positions.push(row)
      recordEvent(actorEmail(), "position.created", "position", row.id)
      return serializePosition(row)
    },

    update: (id, data) => {
      const row = findById(db.positions, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      validate(data, invalid)
      const status = text(data, "status", row.status)
      if (status !== "FILLED" && openAssignmentOn(row.id)) {
        invalid.add(
          "status",
          "Someone holds this position. Move them first, then change the status.",
        )
      }
      invalid.throwIfAny()

      row.job_title = text(data, "job_title", row.job_title)
      row.org_unit = text(data, "org_unit", row.org_unit)
      row.location = optional(data, "location", row.location)
      row.seniority = text(data, "seniority", row.seniority)
      row.is_people_manager = flag(data, "is_people_manager", row.is_people_manager)
      row.status = status
      row.salary_band_min = optional(data, "salary_band_min", row.salary_band_min)
      row.salary_band_max = optional(data, "salary_band_max", row.salary_band_max)
      row.currency = text(data, "currency", row.currency)
      row.headcount = count(data, "headcount", row.headcount)
      recordEvent(actorEmail(), "position.updated", "position", row.id)
      return serializePosition(row)
    },

    remove: (id) => {
      const row = findById(db.positions, id)
      if (!row) throw notFound()
      if (db.assignments.some((assignment) => assignment.position === row.id)) {
        throw refuse("This position has assignment history. Close it instead.")
      }
      removeById(db.positions, row.id)
      recordEvent(actorEmail(), "position.deleted", "position", row.id)
    },
  }
}

function employments(): Collection {
  const validate = (data: Body, invalid: Invalid, self: EmploymentRow | null): void => {
    invalid.require(data, "person", "legal_entity", "employee_code", "hire_date")
    if (text(data, "person") && !findById(db.people, text(data, "person"))) {
      invalid.add("person", "That person does not exist.")
    }
    if (
      text(data, "legal_entity") &&
      !findById(db.legalEntities, text(data, "legal_entity"))
    ) {
      invalid.add("legal_entity", "That legal entity does not exist.")
    }
    const code = text(data, "employee_code")
    if (
      code &&
      db.employments.some((row) => row.id !== self?.id && row.employee_code === code)
    ) {
      invalid.add("employee_code", duplicate("An employment with this code"))
    }
  }

  return {
    list: (params) =>
      listOf(db.employments, serializeEmployment, params, {
        search: [
          "employee_code",
          "work_email",
          "person_detail.display_name",
          "legal_entity_name",
        ],
        filters: ["status", "employment_type", "work_mode", "legal_entity"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      validate(data, invalid, null)
      invalid.throwIfAny()

      const row: EmploymentRow = {
        id: nextId("emp"),
        person: text(data, "person"),
        legal_entity: text(data, "legal_entity"),
        employee_code: text(data, "employee_code"),
        employment_type: text(data, "employment_type", "FULL_TIME"),
        work_mode: text(data, "work_mode", "ONSITE"),
        hire_date: text(data, "hire_date"),
        probation_end_date: optional(data, "probation_end_date", null),
        termination_date: null,
        // Every employment starts here and is walked forward by
        // change-status; the create form cannot set it.
        status: "ONBOARDING",
        timezone: text(data, "timezone", "UTC"),
        work_email: text(data, "work_email"),
        slack_handle: "",
      }
      db.employments.push(row)
      recordEvent(actorEmail(), "employment.created", "employment", row.id)
      return serializeEmployment(row)
    },

    update: (id, data) => {
      const row = findById(db.employments, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      validate(data, invalid, row)
      invalid.throwIfAny()

      row.person = text(data, "person", row.person)
      row.legal_entity = text(data, "legal_entity", row.legal_entity)
      row.employee_code = text(data, "employee_code", row.employee_code)
      row.employment_type = text(data, "employment_type", row.employment_type)
      row.work_mode = text(data, "work_mode", row.work_mode)
      row.hire_date = text(data, "hire_date", row.hire_date)
      row.probation_end_date = optional(data, "probation_end_date", row.probation_end_date)
      row.timezone = text(data, "timezone", row.timezone)
      row.work_email = text(data, "work_email", row.work_email)
      recordEvent(actorEmail(), "employment.updated", "employment", row.id)
      return serializeEmployment(row)
    },

    remove: (id) => {
      const row = findById(db.employments, id)
      if (!row) throw notFound()
      // Managing a unit is the only way to have reports, so this one guard
      // covers both cases.
      if (db.orgUnits.some((unit) => unit.manager_employment === row.id)) {
        throw refuse(
          "This employment manages an org unit. Give that unit a new manager first.",
        )
      }

      // Its assignments go with it, and any seat it held goes back to open.
      for (const assignment of db.assignments.filter((a) => a.employment === row.id)) {
        if (assignment.effective_to === null) freePosition(assignment.position)
        removeById(db.assignments, assignment.id)
      }
      removeById(db.employments, row.id)
      recordEvent(actorEmail(), "employment.deleted", "employment", row.id)
    },
  }
}

function users(): Collection {
  const checkPassword = (password: string, invalid: Invalid): void => {
    // The same three rules Django's default validators apply, so the password
    // field shows a real message instead of always succeeding.
    if (password.length < 8) {
      invalid.add("password", "This password is too short. It must contain at least 8 characters.")
    }
    if (/^\d+$/.test(password)) {
      invalid.add("password", "This password is entirely numeric.")
    }
    if (["password", "12345678", "qwerty123"].includes(password.toLowerCase())) {
      invalid.add("password", "This password is too common.")
    }
  }

  const validate = (data: Body, invalid: Invalid, self: UserRow | null): void => {
    invalid.require(data, "email")
    const email = text(data, "email").toLowerCase()
    if (
      email &&
      db.users.some((row) => row.id !== self?.id && row.email.toLowerCase() === email)
    ) {
      invalid.add("email", duplicate("A user with this email"))
    }
    const person = optional(data, "person", null)
    if (person && !findById(db.people, person)) {
      invalid.add("person", "That person does not exist.")
    }
  }

  return {
    list: (params) =>
      listOf(db.users, serializeUserAccount, params, {
        search: ["email", "person_name"],
        filters: ["status", "auth_provider"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      validate(data, invalid, null)
      invalid.require(data, "password")
      const password = text(data, "password")
      if (password) checkPassword(password, invalid)
      invalid.throwIfAny()

      const row: UserRow = {
        id: nextId("usr"),
        email: text(data, "email"),
        password,
        person: optional(data, "person", null),
        status: text(data, "status", "ACTIVE"),
        auth_provider: text(data, "auth_provider", "LOCAL"),
        mfa_enabled: false,
        is_staff: flag(data, "is_staff", false),
        is_superuser: false,
        last_login_at: null,
        date_joined: new Date().toISOString(),
        roles: [],
        permissions: [],
      }
      db.users.push(row)
      recordEvent(actorEmail(), "user.created", "user", row.id)
      return serializeUserAccount(row)
    },

    update: (id, data) => {
      const row = findById(db.users, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      validate(data, invalid, row)
      const password = text(data, "password")
      // Omitted on edit unless deliberately typed, so saving an unrelated
      // field cannot reset someone's password.
      if (password) checkPassword(password, invalid)
      invalid.throwIfAny()

      row.email = text(data, "email", row.email)
      if (password) row.password = password
      row.person = optional(data, "person", row.person)
      row.status = text(data, "status", row.status)
      row.auth_provider = text(data, "auth_provider", row.auth_provider)
      row.is_staff = flag(data, "is_staff", row.is_staff)
      recordEvent(actorEmail(), "user.updated", "user", row.id)
      return serializeUserAccount(row)
    },

    remove: (id) => {
      const row = findById(db.users, id)
      if (!row) throw notFound()
      if (row.id === session?.userId) {
        throw refuse("You cannot delete the account you are signed in with.")
      }
      removeById(db.users, row.id)
      recordEvent(actorEmail(), "user.deleted", "user", row.id)
    },
  }
}


const ATTENDANCE_TYPES = ["LATE_ARRIVAL", "EARLY_LEAVE", "ABSENCE"]
const ATTENDANCE_JUSTIFICATIONS = ["UNEXCUSED", "EXCUSED", "JUSTIFIED"]

/**
 * One attendance incident, as a plain resource so the editing dialog can add,
 * change and remove them. The strip reads `/attendance/`; this is the write
 * side of the same rows.
 */
function attendanceRecords(): Collection {
  const validate = (data: Body, invalid: Invalid, self: AttendanceEventRow | null) => {
    invalid.require(data, "employment", "date", "type", "justification")

    const employmentId = text(data, "employment")
    const employment = findById(db.employments, employmentId)
    if (employmentId && !employment) {
      invalid.add("employment", "That employment does not exist.")
    }

    const type = text(data, "type")
    if (type && !ATTENDANCE_TYPES.includes(type)) {
      invalid.add("type", "Not an attendance type.")
    }
    const justification = text(data, "justification")
    if (justification && !ATTENDANCE_JUSTIFICATIONS.includes(justification)) {
      invalid.add("justification", "Not a justification.")
    }

    const date = text(data, "date")
    if (employment && date) {
      if (date < employment.hire_date) {
        invalid.add("date", `Before this employment started on ${employment.hire_date}.`)
      }
      if (employment.termination_date && date > employment.termination_date) {
        invalid.add(
          "date",
          `After this employment ended on ${employment.termination_date}.`,
        )
      }
    }

    // A partial incident is measured; an absence is the whole day and is not.
    if (type === "LATE_ARRIVAL" || type === "EARLY_LEAVE") {
      const minutes = Number(data.minutes)
      if (!Number.isFinite(minutes) || minutes <= 0) {
        invalid.add("minutes", "Enter how many minutes.")
      } else if (minutes >= 24 * 60) {
        invalid.add("minutes", "That is a whole day. Record an absence instead.")
      }
    }

    // Same-day rules. Nobody arrives late to a day they never worked, and one
    // of each kind is enough — a second is an edit of the first.
    const sameDay = db.attendance.filter(
      (row) =>
        row.employment === employmentId && row.date === date && row.id !== self?.id,
    )
    if (type === "ABSENCE" && sameDay.length > 0) {
      invalid.add(
        "type",
        "This day already has a late arrival or early leave recorded. Remove it before marking a full-day absence.",
      )
    }
    if (type !== "ABSENCE" && sameDay.some((row) => row.type === "ABSENCE")) {
      invalid.add("type", "This day is already recorded as a full-day absence.")
    }
    if (type && sameDay.some((row) => row.type === type)) {
      invalid.add("type", "That is already recorded for this day. Edit it instead.")
    }
  }

  const write = (row: AttendanceEventRow, data: Body) => {
    row.employment = text(data, "employment", row.employment)
    row.date = text(data, "date", row.date)
    row.type = text(data, "type", row.type) as AttendanceEventRow["type"]
    row.justification = text(
      data,
      "justification",
      row.justification,
    ) as AttendanceEventRow["justification"]
    row.reason = text(data, "reason", row.reason)
    row.minutes = row.type === "ABSENCE" ? null : Number(data.minutes)
  }

  return {
    list: (params) =>
      listOf(db.attendance, serializeIncident, params, {
        search: ["reason"],
        filters: ["employment", "date", "type", "justification"],
      }),

    create: (data) => {
      const invalid = new Invalid()
      validate(data, invalid, null)
      invalid.throwIfAny()

      const row: AttendanceEventRow = {
        id: nextId("att"),
        employment: "",
        date: "",
        type: "LATE_ARRIVAL",
        minutes: null,
        justification: "UNEXCUSED",
        reason: "",
      }
      write(row, data)
      db.attendance.push(row)
      recordEvent(actorEmail(), "attendance.created", "attendance", row.id)
      return serializeIncident(row)
    },

    update: (id, data) => {
      const row = findById(db.attendance, id)
      if (!row) throw notFound()
      const invalid = new Invalid()
      validate(data, invalid, row)
      invalid.throwIfAny()

      write(row, data)
      recordEvent(actorEmail(), "attendance.updated", "attendance", row.id)
      return serializeIncident(row)
    },

    remove: (id) => {
      const row = findById(db.attendance, id)
      if (!row) throw notFound()
      removeById(db.attendance, row.id)
      recordEvent(actorEmail(), "attendance.deleted", "attendance", row.id)
    },
  }
}
const COLLECTIONS: Record<string, () => Collection> = {
  "attendance-records": attendanceRecords,
  people,
  "legal-entities": legalEntities,
  locations,
  "job-titles": jobTitles,
  "org-units": orgUnits,
  positions,
  employments,
  users,
}

// ---------------------------------------------------------------------------
// Endpoints that are not plain collections
// ---------------------------------------------------------------------------

/** A seat nobody holds goes back to OPEN, unless it was deliberately closed. */
function freePosition(positionId: string): void {
  const position = findById(db.positions, positionId)
  if (position && position.status === "FILLED") position.status = "OPEN"
}

function dayBefore(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}

function createAssignment(data: Body): MockResult {
  const invalid = new Invalid()
  invalid.require(data, "employment", "position", "effective_from")

  const employment = findById(db.employments, text(data, "employment"))
  const position = findById(db.positions, text(data, "position"))
  if (!employment) invalid.add("employment", "That employment does not exist.")
  if (!position) invalid.add("position", "That position does not exist.")
  invalid.throwIfAny()
  if (!employment || !position) throw notFound()

  if (employment.status === "TERMINATED") {
    invalid.add("employment", "A terminated employment cannot be assigned a position.")
  }

  const held = openAssignmentOn(position.id)
  if (held && held.employment !== employment.id) {
    const occupant = findById(db.employments, held.employment)
    invalid.add(
      "position",
      `Already held by ${occupant?.employee_code ?? "someone"} since ${held.effective_from}.`,
    )
  }

  const effectiveFrom = text(data, "effective_from")
  const open = openAssignmentFor(employment.id)
  if (open && effectiveFrom <= open.effective_from) {
    invalid.add(
      "effective_from",
      `Overlaps the current assignment, which began on ${open.effective_from}.`,
    )
  }

  // No manager is chosen here any more: moving into a unit *is* the change of
  // reporting line, and cycles cannot happen because the org tree is acyclic.
  invalid.throwIfAny()

  // Close the seat they are leaving the day before the new one starts, so the
  // two never overlap.
  if (open) {
    open.effective_to = dayBefore(effectiveFrom)
    freePosition(open.position)
  }

  const row = {
    id: nextId("as"),
    employment: employment.id,
    position: position.id,
    is_primary: flag(data, "is_primary", true),
    fte_pct: text(data, "fte_pct", "100.00"),
    effective_from: effectiveFrom,
    effective_to: null,
    change_reason: text(data, "change_reason", "HIRE"),
  }
  db.assignments.push(row)
  position.status = "FILLED"
  recordEvent(
    actorEmail(),
    "position_assignment.created",
    "position_assignment",
    row.id,
  )
  return { status: 201, body: serializeAssignment(row) }
}

function changeEmploymentStatus(id: string, data: Body): MockResult {
  const row = findById(db.employments, id)
  if (!row) throw notFound()

  const invalid = new Invalid()
  invalid.require(data, "to_status", "effective_from")
  invalid.throwIfAny()

  const to = text(data, "to_status")
  const allowed = TRANSITIONS[row.status] ?? []
  if (!allowed.includes(to)) {
    invalid.add(
      "to_status",
      allowed.length > 0
        ? `${row.status} can only move to ${allowed.join(", ")}.`
        : `${row.status} is a final status.`,
    )
    invalid.throwIfAny()
  }

  row.status = to
  if (to === "TERMINATED") {
    row.termination_date = text(data, "effective_from")
    const open = openAssignmentFor(row.id)
    if (open) {
      open.effective_to = row.termination_date
      freePosition(open.position)
    }
  }
  recordEvent(actorEmail(), "employment.status_changed", "employment", row.id)
  return { status: 200, body: serializeEmployment(row) }
}

function setUserStatus(id: string, data: Body): MockResult {
  const row = findById(db.users, id)
  if (!row) throw notFound()

  const invalid = new Invalid()
  invalid.require(data, "status")
  if (row.id === session?.userId) {
    invalid.add("detail", "You cannot change the status of your own account.")
  }
  invalid.throwIfAny()

  row.status = text(data, "status")
  recordEvent(actorEmail(), "user.status_changed", "user", row.id)
  return { status: 200, body: serializeUserAccount(row) }
}

// ---------------------------------------------------------------------------
// The router
// ---------------------------------------------------------------------------

function route(
  method: string,
  segments: string[],
  params: URLSearchParams,
  data: Body,
): MockResult {
  const [head, second, third] = segments

  if (head === "directory" && method === "GET") {
    const rows = db.employments.filter(isCurrent)
    return {
      status: 200,
      body: listOf(rows, serializeDirectoryEntry, params, {
        search: ["name", "employee_code", "work_email", "job_title", "org_unit"],
        filters: ["status", "employment_type", "work_mode"],
      }),
    }
  }

  if (head === "headcount" && method === "GET") {
    return { status: 200, body: headcount() }
  }

  if (head === "attendance" && method === "GET") {
    // The window is the caller's: the screen computes day / week / month and
    // sends explicit dates, so there is no server-side notion of "this week".
    const to = params.get("to") ?? new Date().toISOString().slice(0, 10)
    const from = params.get("from") ?? to
    const list = (name: string) =>
      params.get(name)?.split(",").filter(Boolean) ?? []
    return {
      status: 200,
      body: attendanceSummary(from, to, {
        orgUnits: list("org_unit"),
        search: params.get("search") ?? "",
      }),
    }
  }

  if (head === "audit-events" && method === "GET") {
    // Already newest-first in the store; `ordering` can still override it.
    return {
      status: 200,
      body: listOf(db.auditEvents, (row) => row, params, {
        search: ["action", "actor_email", "subject_type", "subject_id"],
        filters: ["action", "subject_type"],
      }),
    }
  }

  if (head === "org-units" && second === "tree" && method === "GET") {
    return { status: 200, body: orgUnitTree() }
  }

  if (head === "position-assignments" && method === "POST") {
    return createAssignment(data)
  }

  if (head === "employments" && second && third === "change-status" && method === "POST") {
    return changeEmploymentStatus(second, data)
  }

  if (head === "users" && second && third === "set-status" && method === "POST") {
    return setUserStatus(second, data)
  }

  const collection = COLLECTIONS[head ?? ""]?.()
  if (!collection) throw notFound()

  if (!second) {
    if (method === "GET") return { status: 200, body: collection.list(params) }
    if (method === "POST" && collection.create) {
      return { status: 201, body: collection.create(data) }
    }
  } else {
    if (method === "PATCH" && collection.update) {
      return { status: 200, body: collection.update(second, data) }
    }
    if (method === "DELETE" && collection.remove) {
      collection.remove(second)
      return { status: 204, body: null }
    }
  }

  throw new HttpError(405, `Method ${method} not allowed.`, "method_not_allowed")
}

/**
 * Handle one request. `path` is everything after the API base, query string
 * included — exactly what `api.ts` would have appended to the URL.
 */
export function handle(
  method: string,
  path: string,
  body: unknown,
  authorization: string | null,
): MockResult {
  const url = new URL(path, "http://mock.local")
  const segments = url.pathname.split("/").filter(Boolean)
  const data = (body ?? {}) as Body

  try {
    const authenticated = authRoutes(method, segments, data)
    if (authenticated) return authenticated

    requireSession(authorization)
    return route(method, segments, url.searchParams, data)
  } catch (caught) {
    if (caught instanceof HttpError) {
      return {
        status: caught.status,
        body: {
          detail: caught.detail,
          code: caught.code,
          status: caught.status,
          ...(caught.errors ? { errors: caught.errors } : {}),
        },
      }
    }
    throw caught
  }
}
