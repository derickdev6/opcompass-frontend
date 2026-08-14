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
  lead_employment: string | null
  lead_name: string | null
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
  lead_name: string | null
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
  manager_employment: string | null
  manager_name: string | null
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
