import { Check } from "lucide-react"
import { useState } from "react"

import {
  CheckboxField,
  FieldRow,
  SelectField,
  TextField,
  enumOptions,
} from "@/components/form/Field"
import type { FieldErrors } from "@/components/form/FormDialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiError, api, query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import type {
  JobTitle,
  LegalEntity,
  Location,
  OrgUnit,
  Person,
  Position,
} from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { cn } from "@/lib/utils"

const SENIORITIES = [
  "INTERN",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "MANAGER",
  "DIRECTOR",
  "EXEC",
] as const
const TYPES = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN", "TEMP"] as const
const MODES = ["ONSITE", "REMOTE", "HYBRID"] as const

const STEPS = ["Job title", "Position", "Person", "Employment", "Review"] as const

const today = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

const EMPTY = {
  jobTitleMode: "existing" as "existing" | "new",
  jobTitleId: "",
  jobTitle: { name: "", code: "", job_family: "", description: "" },

  positionMode: "existing" as "existing" | "new",
  positionId: "",
  position: {
    org_unit: "",
    location: "",
    seniority: "MID",
    is_people_manager: false,
    salary_band_min: "",
    salary_band_max: "",
    currency: "USD",
  },

  personMode: "existing" as "existing" | "new",
  personId: "",
  person: {
    first_name: "",
    last_name: "",
    preferred_name: "",
    personal_email: "",
    personal_phone: "",
  },

  employment: {
    legal_entity: "",
    employee_code: "",
    employment_type: "FULL_TIME",
    work_mode: "ONSITE",
    hire_date: today(),
    work_email: "",
    timezone: "UTC",
  },
}

/** What the finish run has already created, so a retry does not duplicate it. */
interface Created {
  jobTitle?: string
  position?: string
  person?: string
  employment?: string
}

/**
 * The new-hire walkthrough: five steps from a job title to somebody sitting in
 * a seat.
 *
 * **Nothing is written until Finish.** A wizard that ends in a review implies
 * the review is the last chance to back out, so the four or five POSTs all run
 * at the end, in dependency order. If one fails, whatever succeeded is kept in
 * `created` and skipped on the next attempt — a duplicate employee code should
 * cost you one field, not a stray job title every time you retry.
 */
export default function NewHireDialog({
  open,
  onOpenChange,
  onFinished,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinished: () => void
}) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(EMPTY)
  const [created, setCreated] = useState<Created>({})
  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const jobTitles = useApi<Paginated<JobTitle>>(
    `/job-titles/${query({ page_size: 200, ordering: "name" })}`,
  )
  const positions = useApi<Paginated<Position>>(
    `/positions/${query({ page_size: 200, status: "OPEN" })}`,
  )
  const units = useApi<Paginated<OrgUnit>>(
    `/org-units/${query({ page_size: 200, ordering: "code" })}`,
  )
  const locations = useApi<Paginated<Location>>(`/locations/${query({ page_size: 200 })}`)
  const people = useApi<Paginated<Person>>(
    `/people/${query({ page_size: 200, ordering: "display_name" })}`,
  )
  const entities = useApi<Paginated<LegalEntity>>(
    `/legal-entities/${query({ page_size: 200 })}`,
  )

  const reset = () => {
    setStep(0)
    setDraft(EMPTY)
    setCreated({})
    setErrors({})
    setBanner(null)
  }

  const close = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  // Enough to stop someone walking past an empty step. Everything else is the
  // server's to judge, at Finish.
  const blocked = (() => {
    if (step === 0) {
      return draft.jobTitleMode === "existing" ? !draft.jobTitleId : !draft.jobTitle.name
    }
    if (step === 1) {
      return draft.positionMode === "existing"
        ? !draft.positionId
        : !draft.position.org_unit
    }
    if (step === 2) {
      return draft.personMode === "existing"
        ? !draft.personId
        : !draft.person.first_name || !draft.person.last_name
    }
    if (step === 3) {
      return (
        !draft.employment.legal_entity ||
        !draft.employment.employee_code ||
        !draft.employment.hire_date
      )
    }
    return false
  })()

  const finish = async () => {
    setErrors({})
    setBanner(null)
    setBusy(true)
    const done: Created = { ...created }
    try {
      if (!done.jobTitle) {
        done.jobTitle =
          draft.jobTitleMode === "existing"
            ? draft.jobTitleId
            : (await api.post<JobTitle>("/job-titles/", draft.jobTitle)).id
        setCreated({ ...done })
      }

      if (!done.position) {
        done.position =
          draft.positionMode === "existing"
            ? draft.positionId
            : (
                await api.post<Position>("/positions/", {
                  ...draft.position,
                  job_title: done.jobTitle,
                  location: draft.position.location || null,
                  salary_band_min: draft.position.salary_band_min || null,
                  salary_band_max: draft.position.salary_band_max || null,
                  status: "OPEN",
                  headcount: 1,
                })
              ).id
        setCreated({ ...done })
      }

      if (!done.person) {
        done.person =
          draft.personMode === "existing"
            ? draft.personId
            : (
                await api.post<Person>("/people/", {
                  ...draft.person,
                  emergency_contact: [],
                })
              ).id
        setCreated({ ...done })
      }

      if (!done.employment) {
        done.employment = (
          await api.post<{ id: string }>("/employments/", {
            ...draft.employment,
            person: done.person,
            probation_end_date: null,
          })
        ).id
        setCreated({ ...done })
      }

      // Without this the employment has no seat, so no org unit and no
      // manager — which would make choosing a position pointless.
      await api.post("/position-assignments/", {
        employment: done.employment,
        position: done.position,
        is_primary: true,
        effective_from: draft.employment.hire_date,
        change_reason: "HIRE",
      })

      onFinished()
      close(false)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors ?? {})
        setBanner(
          caught.errors && Object.keys(caught.errors).length > 0
            ? "Something in the details was rejected — the step it belongs to is marked."
            : caught.message,
        )
      } else {
        setBanner("Could not reach the server. Try again in a moment.")
      }
    } finally {
      setBusy(false)
    }
  }

  const jobTitleName =
    draft.jobTitleMode === "new"
      ? draft.jobTitle.name
      : (jobTitles.data?.results.find((row) => row.id === draft.jobTitleId)?.name ?? "—")

  const positionSummary =
    draft.positionMode === "new"
      ? `New seat in ${
          units.data?.results.find((row) => row.id === draft.position.org_unit)?.name ??
          "—"
        }`
      : (() => {
          const found = positions.data?.results.find((row) => row.id === draft.positionId)
          return found ? `${found.job_title_name} — ${found.org_unit_name}` : "—"
        })()

  const personName =
    draft.personMode === "new"
      ? `${draft.person.preferred_name || draft.person.first_name} ${draft.person.last_name}`.trim()
      : (people.data?.results.find((row) => row.id === draft.personId)?.display_name ??
        "—")

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New hire</DialogTitle>
          <DialogDescription>
            Job title, seat, person, employment. Nothing is saved until the last step.
          </DialogDescription>
        </DialogHeader>

        {/* Where you are. Steps are not clickable: each one feeds the next. */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 py-1",
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : index < step
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60",
                )}
              >
                {index < step ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <span className="tabular-nums">{index + 1}</span>
                )}
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <span className="text-muted-foreground/40" aria-hidden>
                  /
                </span>
              )}
            </li>
          ))}
        </ol>

        {banner && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {banner}
          </p>
        )}

        <div className="grid gap-4">
          {step === 0 && (
            <>
              <ModeToggle
                label="Job title"
                value={draft.jobTitleMode}
                onChange={(mode) => set("jobTitleMode", mode)}
              />
              {draft.jobTitleMode === "existing" ? (
                <SelectField
                  name="job_title"
                  label="Existing job title"
                  required
                  errors={errors}
                  value={draft.jobTitleId}
                  onChange={(value) => set("jobTitleId", value)}
                  options={(jobTitles.data?.results ?? []).map((row) => ({
                    value: row.id,
                    label: row.name,
                  }))}
                />
              ) : (
                <>
                  <FieldRow>
                    <TextField
                      name="name"
                      label="Name"
                      required
                      errors={errors}
                      value={draft.jobTitle.name}
                      onChange={(name) =>
                        set("jobTitle", { ...draft.jobTitle, name })
                      }
                    />
                    <TextField
                      name="code"
                      label="Code"
                      hint="Unique, e.g. SLS-REP"
                      errors={errors}
                      value={draft.jobTitle.code}
                      onChange={(code) =>
                        set("jobTitle", { ...draft.jobTitle, code })
                      }
                    />
                  </FieldRow>
                  <TextField
                    name="job_family"
                    label="Family"
                    errors={errors}
                    value={draft.jobTitle.job_family}
                    onChange={(job_family) =>
                      set("jobTitle", { ...draft.jobTitle, job_family })
                    }
                  />
                </>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <ModeToggle
                label="Position"
                value={draft.positionMode}
                onChange={(mode) => set("positionMode", mode)}
              />
              {draft.positionMode === "existing" ? (
                <SelectField
                  name="position"
                  label="Open position"
                  required
                  hint="Only open seats are listed — a filled one cannot take a second person."
                  errors={errors}
                  value={draft.positionId}
                  onChange={(value) => set("positionId", value)}
                  options={(positions.data?.results ?? []).map((row) => ({
                    value: row.id,
                    label: `${row.job_title_name} — ${row.org_unit_name}`,
                  }))}
                />
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    The seat will use <span className="font-medium">{jobTitleName}</span>{" "}
                    from the previous step.
                  </p>
                  <FieldRow>
                    <SelectField
                      name="org_unit"
                      label="Org unit"
                      required
                      errors={errors}
                      value={draft.position.org_unit}
                      onChange={(org_unit) =>
                        set("position", { ...draft.position, org_unit })
                      }
                      options={(units.data?.results ?? []).map((row) => ({
                        value: row.id,
                        label: `${row.code} — ${row.name}`,
                      }))}
                    />
                    <SelectField
                      name="location"
                      label="Location"
                      allowEmpty
                      errors={errors}
                      value={draft.position.location}
                      onChange={(location) =>
                        set("position", { ...draft.position, location })
                      }
                      options={(locations.data?.results ?? []).map((row) => ({
                        value: row.id,
                        label: row.name,
                      }))}
                    />
                  </FieldRow>
                  <FieldRow>
                    <SelectField
                      name="seniority"
                      label="Seniority"
                      errors={errors}
                      value={draft.position.seniority}
                      onChange={(seniority) =>
                        set("position", { ...draft.position, seniority })
                      }
                      options={enumOptions(SENIORITIES)}
                    />
                    <TextField
                      name="currency"
                      label="Currency"
                      errors={errors}
                      value={draft.position.currency}
                      onChange={(currency) =>
                        set("position", {
                          ...draft.position,
                          currency: currency.toUpperCase().slice(0, 3),
                        })
                      }
                    />
                  </FieldRow>
                  <FieldRow>
                    <TextField
                      name="salary_band_min"
                      label="Band minimum"
                      type="number"
                      errors={errors}
                      value={draft.position.salary_band_min}
                      onChange={(salary_band_min) =>
                        set("position", { ...draft.position, salary_band_min })
                      }
                    />
                    <TextField
                      name="salary_band_max"
                      label="Band maximum"
                      type="number"
                      errors={errors}
                      value={draft.position.salary_band_max}
                      onChange={(salary_band_max) =>
                        set("position", { ...draft.position, salary_band_max })
                      }
                    />
                  </FieldRow>
                  <CheckboxField
                    name="is_people_manager"
                    label="This position manages people"
                    errors={errors}
                    checked={draft.position.is_people_manager}
                    onChange={(is_people_manager) =>
                      set("position", { ...draft.position, is_people_manager })
                    }
                  />
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <ModeToggle
                label="Person"
                value={draft.personMode}
                onChange={(mode) => set("personMode", mode)}
              />
              {draft.personMode === "existing" ? (
                <SelectField
                  name="person"
                  label="Existing person"
                  required
                  hint="A rehire is the same person with a new employment."
                  errors={errors}
                  value={draft.personId}
                  onChange={(value) => set("personId", value)}
                  options={(people.data?.results ?? []).map((row) => ({
                    value: row.id,
                    label: row.display_name,
                  }))}
                />
              ) : (
                <>
                  <FieldRow>
                    <TextField
                      name="first_name"
                      label="First name"
                      required
                      errors={errors}
                      value={draft.person.first_name}
                      onChange={(first_name) =>
                        set("person", { ...draft.person, first_name })
                      }
                    />
                    <TextField
                      name="last_name"
                      label="Last name"
                      required
                      errors={errors}
                      value={draft.person.last_name}
                      onChange={(last_name) =>
                        set("person", { ...draft.person, last_name })
                      }
                    />
                  </FieldRow>
                  <TextField
                    name="preferred_name"
                    label="Preferred name"
                    hint="What the interface shows. Defaults to the first name."
                    errors={errors}
                    value={draft.person.preferred_name}
                    onChange={(preferred_name) =>
                      set("person", { ...draft.person, preferred_name })
                    }
                  />
                  <FieldRow>
                    <TextField
                      name="personal_email"
                      label="Personal email"
                      type="email"
                      hint="Survives termination."
                      errors={errors}
                      value={draft.person.personal_email}
                      onChange={(personal_email) =>
                        set("person", { ...draft.person, personal_email })
                      }
                    />
                    <TextField
                      name="personal_phone"
                      label="Personal phone"
                      errors={errors}
                      value={draft.person.personal_phone}
                      onChange={(personal_phone) =>
                        set("person", { ...draft.person, personal_phone })
                      }
                    />
                  </FieldRow>
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Always a new employment, even for a rehire. It starts in{" "}
                <span className="font-medium">Onboarding</span>.
              </p>
              <FieldRow>
                <SelectField
                  name="legal_entity"
                  label="Legal entity"
                  required
                  errors={errors}
                  value={draft.employment.legal_entity}
                  onChange={(legal_entity) =>
                    set("employment", { ...draft.employment, legal_entity })
                  }
                  options={(entities.data?.results ?? []).map((row) => ({
                    value: row.id,
                    label: row.name,
                  }))}
                />
                <TextField
                  name="employee_code"
                  label="Employee code"
                  required
                  hint="Unique across the company."
                  errors={errors}
                  value={draft.employment.employee_code}
                  onChange={(employee_code) =>
                    set("employment", { ...draft.employment, employee_code })
                  }
                />
              </FieldRow>
              <FieldRow>
                <SelectField
                  name="employment_type"
                  label="Employment type"
                  errors={errors}
                  value={draft.employment.employment_type}
                  onChange={(employment_type) =>
                    set("employment", { ...draft.employment, employment_type })
                  }
                  options={enumOptions(TYPES)}
                />
                <SelectField
                  name="work_mode"
                  label="Work mode"
                  errors={errors}
                  value={draft.employment.work_mode}
                  onChange={(work_mode) =>
                    set("employment", { ...draft.employment, work_mode })
                  }
                  options={enumOptions(MODES)}
                />
              </FieldRow>
              <FieldRow>
                <TextField
                  name="hire_date"
                  label="Hire date"
                  type="date"
                  required
                  hint="The seat is assigned from this date."
                  errors={errors}
                  value={draft.employment.hire_date}
                  onChange={(hire_date) =>
                    set("employment", { ...draft.employment, hire_date })
                  }
                />
                <TextField
                  name="timezone"
                  label="Timezone"
                  errors={errors}
                  value={draft.employment.timezone}
                  onChange={(timezone) =>
                    set("employment", { ...draft.employment, timezone })
                  }
                />
              </FieldRow>
              <TextField
                name="work_email"
                label="Work email"
                type="email"
                errors={errors}
                value={draft.employment.work_email}
                onChange={(work_email) =>
                  set("employment", { ...draft.employment, work_email })
                }
              />
            </>
          )}

          {step === 4 && (
            <dl className="grid gap-px overflow-hidden rounded-md border bg-border text-sm">
              <Review label="Person" value={personName} isNew={draft.personMode === "new"} />
              <Review label="Job title" value={jobTitleName} isNew={draft.jobTitleMode === "new"} />
              <Review label="Position" value={positionSummary} isNew={draft.positionMode === "new"} />
              <Review label="Employee code" value={draft.employment.employee_code} />
              <Review
                label="Legal entity"
                value={
                  entities.data?.results.find(
                    (row) => row.id === draft.employment.legal_entity,
                  )?.name ?? "—"
                }
              />
              <Review
                label="Type"
                value={`${draft.employment.employment_type.replace(/_/g, " ").toLowerCase()} · ${draft.employment.work_mode.toLowerCase()}`}
              />
              <Review label="Starts" value={draft.employment.hire_date} />
              <Review label="Status on creation" value="Onboarding" />
            </dl>
          )}
        </div>

        <DialogFooter className="mt-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={step === 0 || busy}
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              disabled={blocked}
              onClick={() => setStep((current) => current + 1)}
            >
              Next
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={() => void finish()}>
              {busy ? "Creating…" : "Create hire"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ModeToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: "existing" | "new"
  onChange: (value: "existing" | "new") => void
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${label}-mode`}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as "existing" | "new")}
      >
        <SelectTrigger id={`${label}-mode`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="existing">Use an existing {label.toLowerCase()}</SelectItem>
          <SelectItem value="new">Create a new {label.toLowerCase()}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function Review({
  label,
  value,
  isNew,
}: {
  label: string
  value: string
  isNew?: boolean
}) {
  return (
    <div className="flex items-baseline gap-3 bg-card px-3 py-2">
      <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">
        {value || "—"}
        {isNew && (
          <span className="ml-2 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-xs font-normal text-sky-700 dark:text-sky-300">
            new
          </span>
        )}
      </dd>
    </div>
  )
}
