/**
 * Rows in, API shapes out — the mock's equivalent of the DRF serializers.
 *
 * Every function here returns a type from `lib/types.ts`, so the compiler is
 * what keeps the mock and the real contract in step: change a field on the
 * frontend's view of the API and `npm run build` points at the line here that
 * no longer fills it in.
 */

import type { User } from "@/lib/auth"
import type {
  AttendanceBucket,
  AttendanceDay,
  AttendanceIncident,
  AttendanceRow,
  AttendanceSummary,
  DirectoryEntry,
  Employment,
  Headcount,
  OrgUnit,
  OrgUnitNode,
  Person,
  Position,
  PositionAssignment,
  UserAccount,
} from "@/lib/types"

import { db, findById, openAssignmentFor, openAssignmentOn } from "./db"
import type {
  AssignmentRow,
  AttendanceEventRow,
  EmploymentRow,
  OrgUnitRow,
  PersonRow,
  PositionRow,
  UserRow,
} from "./rows"

/**
 * The employment lifecycle. A transition that is not listed here is rejected:
 * a new hire walks onboarding → training → probation before going active.
 *
 * Two edges are wider than spec §5.0's diagram, because the diagram leaves
 * people stuck: someone who quits in week one can be terminated straight from
 * ONBOARDING or TRAINING, and someone who resigns while away can go from
 * ON_LEAVE to OFFBOARDING. Without those, the only legal path out is to march
 * them forward through states they were never in, which makes the status
 * history a lie.
 */
export const TRANSITIONS: Record<string, string[]> = {
  ONBOARDING: ["TRAINING", "TERMINATED"],
  TRAINING: ["PROBATION", "TERMINATED"],
  PROBATION: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["ON_LEAVE", "SUSPENDED", "OFFBOARDING"],
  ON_LEAVE: ["ACTIVE", "OFFBOARDING"],
  SUSPENDED: ["ACTIVE", "TERMINATED"],
  OFFBOARDING: ["TERMINATED"],
  TERMINATED: [],
}

/** Everyone still on the books. The directory and headcount both use this. */
export function isCurrent(row: EmploymentRow): boolean {
  return row.status !== "TERMINATED"
}

export function displayName(row: PersonRow): string {
  return `${row.preferred_name || row.first_name} ${row.last_name}`
}

export function legalName(row: PersonRow): string {
  return `${row.first_name} ${row.last_name}`
}

export function serializePerson(row: PersonRow): Person {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    preferred_name: row.preferred_name,
    display_name: displayName(row),
    legal_name: legalName(row),
    // national_id is deliberately absent: restricted PII, write-only.
    national_id_country: row.national_id_country,
    birth_date: row.birth_date,
    gender: row.gender,
    personal_email: row.personal_email,
    personal_phone: row.personal_phone,
    emergency_contact: row.emergency_contact,
  }
}

/** The name of whoever holds an employment, for the manager columns. */
function nameOfEmployment(employmentId: string | null): string | null {
  const employment = findById(db.employments, employmentId)
  if (!employment) return null
  const person = findById(db.people, employment.person)
  return person ? displayName(person) : null
}

/** The unit an employment currently sits in, via its open assignment. */
function unitOf(employmentId: string): OrgUnitRow | null {
  const assignment = openAssignmentFor(employmentId)
  const position = findById(db.positions, assignment?.position)
  return position ? findById(db.orgUnits, position.org_unit) : null
}

/**
 * Who this employment reports to.
 *
 * **The whole reporting hierarchy comes from here.** There is no per-person
 * manager field: your manager is the manager of your org unit, and if that is
 * you, it is the manager of the nearest unit above yours. Two consequences
 * worth knowing — a unit with no manager is transparent, its members reporting
 * straight to the level above; and reporting cycles are impossible, because the
 * org tree is already acyclic.
 */
export function managerOf(employmentId: string): EmploymentRow | null {
  let unit = unitOf(employmentId)
  let guard = 0
  while (unit && guard < 20) {
    // Managing your own unit means reporting upward, not to yourself.
    if (unit.manager_employment && unit.manager_employment !== employmentId) {
      return findById(db.employments, unit.manager_employment)
    }
    unit = unit.parent ? findById(db.orgUnits, unit.parent) : null
    guard += 1
  }
  // The top of the chain. Winit holds nobody, so approvals stop at C-Level.
  return null
}

function depthOf(row: OrgUnitRow): number {
  let depth = 0
  let current: OrgUnitRow | null = row
  // The parent guard rejects cycles on write, but a bad fixture should not
  // hang the app either.
  while (current?.parent && depth < 20) {
    current = findById(db.orgUnits, current.parent)
    depth += 1
  }
  return depth
}

/** Filled seats directly in a unit — descendants are counted under their own. */
function filledSeats(unitId: string): number {
  return db.assignments.filter((assignment) => {
    if (assignment.effective_to !== null) return false
    const position = findById(db.positions, assignment.position)
    return position?.org_unit === unitId
  }).length
}

export function serializeOrgUnit(row: OrgUnitRow): OrgUnit {
  const parent = findById(db.orgUnits, row.parent)
  return {
    id: row.id,
    parent: row.parent,
    parent_name: parent?.name ?? null,
    name: row.name,
    code: row.code,
    type: row.type,
    manager_employment: row.manager_employment,
    manager_name: nameOfEmployment(row.manager_employment),
    cost_center: row.cost_center,
    legal_entity: row.legal_entity,
    is_active: row.is_active,
    depth: depthOf(row),
    headcount: filledSeats(row.id),
  }
}

/** The org chart: roots first, each with its children nested underneath. */
export function orgUnitTree(): OrgUnitNode[] {
  const build = (row: OrgUnitRow): OrgUnitNode => ({
    id: row.id,
    name: row.name,
    code: row.code,
    type: row.type,
    manager_employment: row.manager_employment,
    manager_name: nameOfEmployment(row.manager_employment),
    cost_center: row.cost_center,
    position_count: db.positions.filter((position) => position.org_unit === row.id)
      .length,
    children: db.orgUnits
      .filter((child) => child.parent === row.id)
      .map((child) => build(child)),
  })

  return db.orgUnits.filter((row) => row.parent === null).map((row) => build(row))
}

function occupantOf(positionId: string) {
  const assignment = openAssignmentOn(positionId)
  const employment = findById(db.employments, assignment?.employment)
  const person = findById(db.people, employment?.person)
  if (!assignment || !employment || !person) return null
  return {
    employment_id: employment.id,
    employee_code: employment.employee_code,
    name: displayName(person),
  }
}

export function serializePosition(row: PositionRow): Position {
  const jobTitle = findById(db.jobTitles, row.job_title)
  const orgUnit = findById(db.orgUnits, row.org_unit)
  const location = findById(db.locations, row.location)
  return {
    id: row.id,
    job_title: row.job_title,
    job_title_name: jobTitle?.name ?? "—",
    org_unit: row.org_unit,
    org_unit_name: orgUnit?.name ?? "—",
    location: row.location,
    location_name: location?.name ?? null,
    seniority: row.seniority,
    is_people_manager: row.is_people_manager,
    status: row.status,
    salary_band_min: row.salary_band_min,
    salary_band_max: row.salary_band_max,
    currency: row.currency,
    headcount: row.headcount,
    occupant: occupantOf(row.id),
  }
}

export function serializeEmployment(row: EmploymentRow): Employment {
  const person = findById(db.people, row.person)
  const entity = findById(db.legalEntities, row.legal_entity)
  const assignment = openAssignmentFor(row.id)
  const position = findById(db.positions, assignment?.position)
  const jobTitle = findById(db.jobTitles, position?.job_title)
  const orgUnit = findById(db.orgUnits, position?.org_unit)
  const manager = managerOf(row.id)
  const managerPerson = findById(db.people, manager?.person)

  return {
    id: row.id,
    person: row.person,
    person_detail: {
      id: person?.id ?? "",
      display_name: person ? displayName(person) : "—",
      personal_email: person?.personal_email ?? "",
    },
    legal_entity: row.legal_entity,
    legal_entity_name: entity?.name ?? "—",
    employee_code: row.employee_code,
    employment_type: row.employment_type,
    work_mode: row.work_mode,
    hire_date: row.hire_date,
    probation_end_date: row.probation_end_date,
    termination_date: row.termination_date,
    status: row.status,
    timezone: row.timezone,
    work_email: row.work_email,
    current_position:
      assignment && position
        ? {
            assignment_id: assignment.id,
            position_id: position.id,
            job_title: jobTitle?.name ?? "—",
            org_unit: orgUnit?.name ?? "—",
            org_unit_id: position.org_unit,
            seniority: position.seniority,
            effective_from: assignment.effective_from,
          }
        : null,
    manager:
      manager && managerPerson
        ? {
            employment_id: manager.id,
            employee_code: manager.employee_code,
            name: displayName(managerPerson),
          }
        : null,
    allowed_transitions: TRANSITIONS[row.status] ?? [],
  }
}

export function serializeAssignment(row: AssignmentRow): PositionAssignment {
  const employment = findById(db.employments, row.employment)
  const person = findById(db.people, employment?.person)
  const position = findById(db.positions, row.position)
  const jobTitle = findById(db.jobTitles, position?.job_title)
  const orgUnit = findById(db.orgUnits, position?.org_unit)
  return {
    id: row.id,
    employment: row.employment,
    employee_name: person ? displayName(person) : "—",
    employee_code: employment?.employee_code ?? "",
    position: row.position,
    job_title: jobTitle?.name ?? "—",
    org_unit: orgUnit?.name ?? "—",
    is_primary: row.is_primary,
    fte_pct: row.fte_pct,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    change_reason: row.change_reason,
    is_current: row.effective_to === null,
  }
}

export function serializeUserAccount(row: UserRow): UserAccount {
  const person = findById(db.people, row.person)
  return {
    id: row.id,
    email: row.email,
    person: row.person,
    person_name: person ? displayName(person) : null,
    status: row.status,
    // Status is the only thing that decides this; it is never set directly.
    can_sign_in: row.status === "ACTIVE",
    auth_provider: row.auth_provider,
    mfa_enabled: row.mfa_enabled,
    is_staff: row.is_staff,
    is_active: row.status === "ACTIVE",
    last_login_at: row.last_login_at,
    date_joined: row.date_joined,
  }
}

/** The `/auth/me/` payload, which carries roles and permissions. */
export function serializeSessionUser(row: UserRow): User {
  const person = findById(db.people, row.person)
  return {
    id: row.id,
    email: row.email,
    person: row.person,
    person_name: person ? displayName(person) : null,
    status: row.status,
    auth_provider: row.auth_provider,
    mfa_enabled: row.mfa_enabled,
    is_staff: row.is_staff,
    is_superuser: row.is_superuser,
    roles: row.roles,
    permissions: row.permissions,
    last_login_at: row.last_login_at,
  }
}

/** The flattened read model behind the Directory screen. */
export function serializeDirectoryEntry(row: EmploymentRow): DirectoryEntry {
  const person = findById(db.people, row.person)
  const assignment = openAssignmentFor(row.id)
  const position = findById(db.positions, assignment?.position)
  const jobTitle = findById(db.jobTitles, position?.job_title)
  const orgUnit = findById(db.orgUnits, position?.org_unit)
  const location = findById(db.locations, position?.location)

  return {
    id: row.id,
    employee_code: row.employee_code,
    name: person ? displayName(person) : "—",
    pronouns: person?.pronouns ?? "",
    work_email: row.work_email,
    status: row.status,
    employment_type: row.employment_type,
    work_mode: row.work_mode,
    timezone: row.timezone,
    hire_date: row.hire_date,
    job_title: jobTitle?.name ?? null,
    org_unit: orgUnit?.name ?? null,
    location: location?.name ?? null,
    manager_name: nameOfEmployment(managerOf(row.id)?.id ?? null),
    slack_handle: row.slack_handle,
  }
}

function tally(rows: EmploymentRow[], key: keyof EmploymentRow): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const value = String(row[key])
    counts[value] = (counts[value] ?? 0) + 1
  }
  return counts
}

export function headcount(): Headcount {
  const current = db.employments.filter(isCurrent)

  const byOrgUnit = new Map<string, number>()
  for (const assignment of db.assignments) {
    if (assignment.effective_to !== null) continue
    const position = findById(db.positions, assignment.position)
    if (!position) continue
    byOrgUnit.set(position.org_unit, (byOrgUnit.get(position.org_unit) ?? 0) + 1)
  }

  return {
    total: current.length,
    by_status: tally(current, "status"),
    by_employment_type: tally(current, "employment_type"),
    by_work_mode: tally(current, "work_mode"),
    by_org_unit: [...byOrgUnit.entries()]
      .map(([unitId, count]) => ({
        position__org_unit__name: findById(db.orgUnits, unitId)?.name ?? "—",
        position__org_unit_id: unitId,
        headcount: count,
      }))
      .sort((a, b) => b.headcount - a.headcount),
    open_positions: db.positions.filter((position) => position.status === "OPEN")
      .length,
  }
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/** Upper bound of each reporting bracket, in minutes. */
const BUCKETS: { limit: number; bucket: AttendanceBucket }[] = [
  { limit: 15, bucket: "M15" },
  { limit: 30, bucket: "M30" },
  { limit: 60, bucket: "H1" },
  { limit: 120, bucket: "H2" },
  { limit: 180, bucket: "H3" },
  { limit: Infinity, bucket: "H4" },
]

/** Null for a full-day absence: there is nothing partial to bracket. */
function bucketOf(minutes: number | null): AttendanceBucket | null {
  if (minutes === null) return null
  return BUCKETS.find((entry) => minutes <= entry.limit)?.bucket ?? "H4"
}

/** Worst wins: one unexcused incident colours the day even beside excused ones. */
const SEVERITY: Record<AttendanceDay["status"], number> = {
  // NONE sits below OFF so a weekend keeps looking like a weekend wherever
  // these are compared.
  NONE: -3,
  FUTURE: -2,
  OFF: -1,
  CLEAN: 0,
  JUSTIFIED: 1,
  EXCUSED: 2,
  UNEXCUSED: 3,
}

function worst(a: AttendanceDay["status"], b: AttendanceDay["status"]) {
  return SEVERITY[b] > SEVERITY[a] ? b : a
}

/** Every date from `from` to `to` inclusive, as YYYY-MM-DD. */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = []
  const cursor = new Date(from + "T00:00:00Z")
  const end = new Date(to + "T00:00:00Z")
  // Capped so a mistyped range cannot spin: the strip only draws 31 anyway.
  while (cursor <= end && dates.length < 366) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function isWeekend(date: string): boolean {
  const day = new Date(date + "T00:00:00Z").getUTCDay()
  return day === 0 || day === 6
}

export function serializeIncident(row: AttendanceEventRow): AttendanceIncident {
  return {
    id: row.id,
    employment: row.employment,
    date: row.date,
    type: row.type,
    bucket: bucketOf(row.minutes),
    minutes: row.minutes,
    justification: row.justification,
    reason: row.reason,
  }
}

interface AttendanceFilters {
  /** Org unit ids. Empty means every unit. */
  orgUnits?: string[]
  /** Matches the person's name or employee code, like every other screen. */
  search?: string
}

/**
 * The Attendance screen's single payload: one day strip per person.
 *
 * Flat on purpose — the org unit is a filter and a column, not a grouping.
 */
export function attendanceSummary(
  from: string,
  to: string,
  filters: AttendanceFilters = {},
): AttendanceSummary {
  const dates = datesBetween(from, to)
  const today = new Date()
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  const totals = { late: 0, early: 0, absent: 0, unexcused: 0, excused: 0, justified: 0 }

  const byEmployment = new Map<string, AttendanceEventRow[]>()
  for (const row of db.attendance) {
    if (row.date < from || row.date > to) continue
    byEmployment.set(row.employment, [...(byEmployment.get(row.employment) ?? []), row])
  }

  const needle = filters.search?.trim().toLowerCase() ?? ""
  const units = filters.orgUnits ?? []

  // Anyone whose employment overlaps the window, so somebody hired midway
  // through shows blank cells before their start rather than false clean ones.
  const employments = db.employments.filter((row) => {
    if (row.hire_date > to) return false
    if (row.termination_date && row.termination_date < from) return false
    if (needle) {
      const person = findById(db.people, row.person)
      const name = person ? displayName(person).toLowerCase() : ""
      if (!name.includes(needle) && !row.employee_code.toLowerCase().includes(needle)) {
        return false
      }
    }
    return true
  })

  const people: AttendanceRow[] = []

  for (const employment of employments) {
    const assignment = openAssignmentFor(employment.id)
    const position = findById(db.positions, assignment?.position)
    const unit = findById(db.orgUnits, position?.org_unit)
    // Filtering by unit is exact, not by subtree: the picker lists every unit,
    // so choosing a department and its teams is two ticks rather than a rule.
    if (units.length > 0 && !units.includes(unit?.id ?? "")) continue

    const person = findById(db.people, employment.person)
    const jobTitle = findById(db.jobTitles, position?.job_title)
    const incidents = byEmployment.get(employment.id) ?? []

    const byDate = new Map<string, AttendanceIncident[]>()
    for (const row of incidents) {
      byDate.set(row.date, [...(byDate.get(row.date) ?? []), serializeIncident(row)])
      if (row.type === "LATE_ARRIVAL") totals.late += 1
      else if (row.type === "EARLY_LEAVE") totals.early += 1
      else totals.absent += 1
      if (row.justification === "UNEXCUSED") totals.unexcused += 1
      else if (row.justification === "EXCUSED") totals.excused += 1
      else totals.justified += 1
    }

    const days: AttendanceDay[] = dates.map((date) => {
      const holiday = holidayOn(date)
      const dayIncidents = byDate.get(date) ?? []

      const outside =
        date < employment.hire_date ||
        (employment.termination_date !== null && date > employment.termination_date)
      if (outside) {
        return { date, status: "NONE", absent: false, holiday, incidents: [] }
      }
      // Still to come — checked before the calendar, so the unwritten end of a
      // week is uniformly shells rather than a run of filled Saturdays that
      // look like settled data.
      if (date > todayIso) {
        return { date, status: "FUTURE", absent: false, holiday, incidents: [] }
      }

      // **Every day is a working day if there is evidence it was worked.** A
      // record is that evidence, so a Saturday or a holiday someone came in on
      // resolves exactly like a Tuesday. Only when nothing was recorded does
      // the calendar get to call it a day off — which is what makes paying
      // hours back at the weekend visible rather than swallowed.
      if (dayIncidents.length === 0 && (holiday || isWeekend(date))) {
        return { date, status: "OFF", absent: false, holiday, incidents: [] }
      }

      let status: AttendanceDay["status"] = "CLEAN"
      for (const incident of dayIncidents) status = worst(status, incident.justification)
      return {
        date,
        status,
        absent: dayIncidents.some((incident) => incident.type === "ABSENCE"),
        holiday,
        incidents: dayIncidents,
      }
    })

    people.push({
      employment: employment.id,
      employee_code: employment.employee_code,
      name: person ? displayName(person) : "—",
      job_title: jobTitle?.name ?? null,
      org_unit: unit?.id ?? null,
      org_unit_name: unit?.name ?? null,
      late_count: incidents.filter((row) => row.type === "LATE_ARRIVAL").length,
      early_count: incidents.filter((row) => row.type === "EARLY_LEAVE").length,
      absent_count: incidents.filter((row) => row.type === "ABSENCE").length,
      days,
    })
  }

  people.sort((a, b) => a.name.localeCompare(b.name))

  return {
    from,
    to,
    dates,
    people,
    totals,
  }
}

// ---------------------------------------------------------------------------
// US federal holidays
// ---------------------------------------------------------------------------

/** The nth given weekday of a month, e.g. the 3rd Monday of January. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): Date {
  const first = new Date(Date.UTC(year, month, 1))
  const shift = (weekday - first.getUTCDay() + 7) % 7
  return new Date(Date.UTC(year, month, 1 + shift + (nth - 1) * 7))
}

/** The last given weekday of a month — Memorial Day's rule. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0))
  const shift = (last.getUTCDay() - weekday + 7) % 7
  return new Date(Date.UTC(year, month + 1, 0 - shift))
}

function utcIso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * A fixed-date holiday is *observed* on the nearest weekday: Saturday moves
 * back to Friday, Sunday forward to Monday. That observed date is the one
 * people are actually off, which is the only one attendance cares about.
 */
function observed(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day))
  const weekday = date.getUTCDay()
  if (weekday === 6) date.setUTCDate(date.getUTCDate() - 1)
  if (weekday === 0) date.setUTCDate(date.getUTCDate() + 1)
  return utcIso(date)
}

/** Computed once per year, then reused — the dates never change. */
const HOLIDAY_CACHE = new Map<number, Map<string, string>>()

function holidaysFor(year: number): Map<string, string> {
  const cached = HOLIDAY_CACHE.get(year)
  if (cached) return cached

  const days = new Map<string, string>([
    [observed(year, 0, 1), "New Year's Day"],
    [utcIso(nthWeekday(year, 0, 1, 3)), "Martin Luther King Jr. Day"],
    [utcIso(nthWeekday(year, 1, 1, 3)), "Washington's Birthday"],
    [utcIso(lastWeekday(year, 4, 1)), "Memorial Day"],
    [observed(year, 5, 19), "Juneteenth National Independence Day"],
    [observed(year, 6, 4), "Independence Day"],
    [utcIso(nthWeekday(year, 8, 1, 1)), "Labor Day"],
    [utcIso(nthWeekday(year, 9, 1, 2)), "Columbus Day"],
    [observed(year, 10, 11), "Veterans Day"],
    [utcIso(nthWeekday(year, 10, 4, 4)), "Thanksgiving Day"],
    [observed(year, 11, 25), "Christmas Day"],
  ])
  HOLIDAY_CACHE.set(year, days)
  return days
}

/**
 * The holiday falling on a date, or null.
 *
 * Hardcoded because the backend's `calendar_day` table exists but has no data
 * in it. When it is populated this becomes a lookup, and holidays stop being
 * US-only — see API_REQUIREMENTS.md §4.6.
 */
export function holidayOn(date: string): string | null {
  const year = Number(date.slice(0, 4))
  if (!Number.isFinite(year)) return null
  return holidaysFor(year).get(date) ?? null
}
