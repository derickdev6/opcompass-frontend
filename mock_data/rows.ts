/**
 * The mock "tables".
 *
 * These are storage rows, not API responses. Everything the API computes —
 * display names, parent names, occupants, headcounts — is derived in
 * `serializers.ts`, exactly as the Django serializers derive it. Keeping the
 * split means a write through the UI shows up everywhere it should: assign
 * someone to a position and the directory, the org unit's filled count and the
 * dashboard all move together.
 *
 * Flat entities whose stored shape already equals their response shape are
 * aliased to the response type, so a change to `lib/types.ts` breaks the seed
 * at build time rather than at runtime.
 */

import type {
  AuditEvent,
  EmergencyContact,
  JobTitle,
  LegalEntity,
  Location,
} from "@/lib/types"

export type LegalEntityRow = LegalEntity
export type LocationRow = Location
export type JobTitleRow = JobTitle
export type AuditEventRow = AuditEvent

export interface PersonRow {
  id: string
  first_name: string
  last_name: string
  preferred_name: string
  /** Restricted PII. Stored, never serialised — the API is write-only here. */
  national_id: string
  national_id_country: string
  birth_date: string | null
  gender: string | null
  personal_email: string
  personal_phone: string
  /** Shown in the directory, not on the person record. */
  pronouns: string
  emergency_contact: EmergencyContact[]
}

export interface OrgUnitRow {
  id: string
  parent: string | null
  name: string
  code: string
  type: string
  /** The employment leading this unit, not the person. */
  lead_employment: string | null
  cost_center: string
  legal_entity: string | null
  is_active: boolean
}

export interface PositionRow {
  id: string
  job_title: string
  org_unit: string
  location: string | null
  seniority: string
  is_people_manager: boolean
  status: string
  salary_band_min: string | null
  salary_band_max: string | null
  currency: string
  headcount: number
}

export interface EmploymentRow {
  id: string
  person: string
  legal_entity: string
  employee_code: string
  employment_type: string
  work_mode: string
  hire_date: string
  probation_end_date: string | null
  termination_date: string | null
  status: string
  timezone: string
  work_email: string
  slack_handle: string
}

export interface AssignmentRow {
  id: string
  employment: string
  position: string
  manager_employment: string | null
  is_primary: boolean
  fte_pct: string
  effective_from: string
  /** `null` means open — this is the employment's current seat. */
  effective_to: string | null
  change_reason: string
}

export interface UserRow {
  id: string
  email: string
  /**
   * Fake, and only ever compared inside the browser. The mock has no server to
   * send it to and no real account behind it.
   */
  password: string
  person: string | null
  status: string
  auth_provider: string
  mfa_enabled: boolean
  is_staff: boolean
  is_superuser: boolean
  last_login_at: string | null
  date_joined: string
  roles: { code: string; scope_type: string; scope_id: string | null }[]
  /** Flat permission codes, or `["*"]` for a superuser. */
  permissions: string[]
}

export interface MockDb {
  people: PersonRow[]
  legalEntities: LegalEntityRow[]
  locations: LocationRow[]
  jobTitles: JobTitleRow[]
  orgUnits: OrgUnitRow[]
  positions: PositionRow[]
  employments: EmploymentRow[]
  assignments: AssignmentRow[]
  users: UserRow[]
  auditEvents: AuditEventRow[]
}
