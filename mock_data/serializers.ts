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
import type { AssignmentRow, EmploymentRow, OrgUnitRow, PersonRow, PositionRow, UserRow } from "./rows"

/**
 * The employment lifecycle from spec §5.0. A transition that is not listed
 * here is rejected — `PREBOARDING → ACTIVE` has to walk through onboarding and
 * probation like everyone else.
 */
export const TRANSITIONS: Record<string, string[]> = {
  PREBOARDING: ["ONBOARDING"],
  ONBOARDING: ["PROBATION"],
  PROBATION: ["ACTIVE", "TERMINATED"],
  ACTIVE: ["ON_LEAVE", "SUSPENDED", "OFFBOARDING"],
  ON_LEAVE: ["ACTIVE"],
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

/** The name of whoever holds an employment, for lead and manager columns. */
function nameOfEmployment(employmentId: string | null): string | null {
  const employment = findById(db.employments, employmentId)
  if (!employment) return null
  const person = findById(db.people, employment.person)
  return person ? displayName(person) : null
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
    lead_name: nameOfEmployment(row.lead_employment),
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
    lead_employment: row.lead_employment,
    lead_name: nameOfEmployment(row.lead_employment),
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
  const manager = findById(db.employments, assignment?.manager_employment)
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
    manager_employment: row.manager_employment,
    manager_name: nameOfEmployment(row.manager_employment),
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
    manager_name: nameOfEmployment(assignment?.manager_employment ?? null),
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
