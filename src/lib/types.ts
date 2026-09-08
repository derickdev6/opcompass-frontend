/** Shapes returned by the OP Compass API. Mirrors the backend serializers. */

export interface DirectoryEntry {
  id: string
  employee_code: string
  name: string
  pronouns: string
  work_email: string
  status: string
  employment_type: string
  work_mode: string
  timezone: string
  hire_date: string
  job_title: string | null
  org_unit: string | null
  location: string | null
  manager_name: string | null
  slack_handle: string
}

export interface OrgUnitNode {
  id: string
  name: string
  code: string
  type: string
  manager_employment: string | null
  manager_name: string | null
  cost_center: string
  position_count: number
  children: OrgUnitNode[]
}

export interface OrgUnit {
  id: string
  parent: string | null
  parent_name: string | null
  name: string
  code: string
  type: string
  /**
   * The unit's manager, and the only field defining the reporting hierarchy.
   * Must be a direct member. Every person's line manager is derived from it.
   */
  manager_employment: string | null
  manager_name: string | null
  cost_center: string
  legal_entity: string | null
  is_active: boolean
  depth: number
  headcount: number
}

export interface Position {
  id: string
  job_title: string
  job_title_name: string
  org_unit: string
  org_unit_name: string
  location: string | null
  location_name: string | null
  seniority: string
  is_people_manager: boolean
  status: string
  salary_band_min: string | null
  salary_band_max: string | null
  currency: string
  headcount: number
  occupant: { employment_id: string; employee_code: string; name: string } | null
}

export interface EmergencyContact {
  name?: string
  relation?: string
  phone?: string
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  preferred_name: string
  display_name: string
  legal_name: string
  /** Never returned by the API — write-only, restricted PII. */
  national_id_country: string
  birth_date: string | null
  gender: string | null
  personal_email: string
  personal_phone: string
  emergency_contact: EmergencyContact[]
}

export interface PositionAssignment {
  id: string
  employment: string
  employee_name: string
  employee_code: string
  position: string
  job_title: string
  org_unit: string
  is_primary: boolean
  fte_pct: string
  effective_from: string
  effective_to: string | null
  change_reason: string
  is_current: boolean
}

export interface UserAccount {
  id: string
  email: string
  person: string | null
  person_name: string | null
  status: string
  can_sign_in: boolean
  auth_provider: string
  mfa_enabled: boolean
  is_staff: boolean
  is_active: boolean
  last_login_at: string | null
  date_joined: string
}

export interface Employment {
  id: string
  person: string
  person_detail: { id: string; display_name: string; personal_email: string }
  legal_entity: string
  legal_entity_name: string
  employee_code: string
  employment_type: string
  work_mode: string
  hire_date: string
  probation_end_date: string | null
  termination_date: string | null
  status: string
  timezone: string
  work_email: string
  current_position: {
    assignment_id: string
    position_id: string
    job_title: string
    org_unit: string
    org_unit_id: string
    seniority: string
    effective_from: string
  } | null
  manager: { employment_id: string; employee_code: string; name: string } | null
  allowed_transitions: string[]
}

export interface Headcount {
  total: number
  by_status: Record<string, number>
  by_employment_type: Record<string, number>
  by_work_mode: Record<string, number>
  by_org_unit: {
    position__org_unit__name: string
    position__org_unit_id: string
    headcount: number
  }[]
  open_positions: number
}

export interface LegalEntity {
  id: string
  name: string
  tax_id: string
  country: string
  currency: string
  timezone: string
  is_active: boolean
}

export interface Location {
  id: string
  name: string
  type: string
  timezone: string
  country: string
  is_active: boolean
}

export interface JobTitle {
  id: string
  name: string
  code: string
  description: string
  job_family: string
  is_active: boolean
}

export interface AuditEvent {
  id: string
  actor_email: string | null
  action: string
  subject_type: string
  subject_id: string | null
  occurred_at: string
  ip: string | null
}

// --- Attendance -----------------------------------------------------------

/** What was logged against a day. */
export type AttendanceType = "LATE_ARRIVAL" | "EARLY_LEAVE" | "ABSENCE"

/** Whether it counts against the person. Applies to all three types. */
export type AttendanceJustification = "UNEXCUSED" | "EXCUSED" | "JUSTIFIED"

/** How far outside the schedule, in the brackets the business tracks. */
export type AttendanceBucket = "M15" | "M30" | "H1" | "H2" | "H3" | "H4"

export interface AttendanceIncident {
  id: string
  employment: string
  date: string
  type: AttendanceType
  /** Null for a full-day absence: there is no partial figure to bracket. */
  bucket: AttendanceBucket | null
  minutes: number | null
  justification: AttendanceJustification
  reason: string
}

/**
 * One cell of the day strip.
 *
 * `status` is what colours the bar: `CLEAN` when the day was worked with
 * nothing logged, otherwise the **worst** justification of that day's
 * incidents. Three states count neither for nor against: `OFF` is a
 * non-working day, `NONE` falls outside the employment, and `FUTURE` has not
 * happened yet — a day still to come is not a day worked cleanly.
 *
 * `absent` is drawn on top of the colour rather than as another colour, so a
 * whole day missed is never mistaken for arriving a quarter of an hour late.
 *
 * `holiday` names the public holiday a date falls on, whether or not it was
 * worked — a red bar on Thanksgiving should say so.
 */
export interface AttendanceDay {
  date: string
  status: "CLEAN" | "JUSTIFIED" | "EXCUSED" | "UNEXCUSED" | "OFF" | "NONE" | "FUTURE"
  absent: boolean
  holiday: string | null
  incidents: AttendanceIncident[]
}

export interface AttendanceRow {
  employment: string
  employee_code: string
  name: string
  job_title: string | null
  org_unit: string | null
  org_unit_name: string | null
  late_count: number
  early_count: number
  absent_count: number
  days: AttendanceDay[]
}

export interface AttendanceSummary {
  from: string
  to: string
  /** Every date in the window, so a row and its header stay aligned. */
  dates: string[]
  people: AttendanceRow[]
  totals: {
    late: number
    early: number
    absent: number
    unexcused: number
    excused: number
    justified: number
  }
}

// ---------------------------------------------------------------------------
// Appraisals
// ---------------------------------------------------------------------------

/** A one-off prize draw. Participants and their ticket counts live separately. */
export interface Raffle {
  id: string
  name: string
  /** YYYY-MM-DD. */
  date: string
  description: string
  participant_count: number
  total_tickets: number
}

export interface RaffleEntry {
  id: string
  raffle: string
  employment: string
  employee_code: string
  person_name: string
  org_unit_name: string | null
  /** How many entries this person holds. Always at least one. */
  tickets: number
}

/** One six-month step, whether or not it has been reached or paid. */
export interface TenureMilestone {
  /** 1 is six months, 2 is a year, and so on. */
  milestone: number
  /** YYYY-MM-DD. */
  due_date: string
  reached: boolean
  paid: boolean
  bonus_id: string | null
  paid_on: string | null
  amount: string | null
  note: string
}

/**
 * Where one person stands on the six-month bonus.
 *
 * Derived from the hire date on every read — only the payments are stored, so
 * correcting a start date moves the whole schedule with it.
 */
export interface TenureStanding {
  employment: string
  employee_code: string
  name: string
  org_unit_name: string | null
  status: string
  hire_date: string
  months_of_service: number
  milestones_reached: number
  milestones_paid: number
  /** Reached but not yet paid. */
  outstanding: number
  bonus_status: "DUE" | "UP_TO_DATE"
  /** When the next unreached milestone falls. */
  next_due: string
  milestones: TenureMilestone[]
}
