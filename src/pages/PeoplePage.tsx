import { Plus } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import { FieldRow, SelectField, TextField, enumOptions } from "@/components/form/Field"
import RowActions from "@/components/form/RowActions"
import FilterMenu from "@/components/list/FilterMenu"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Paginated } from "@/lib/api"
import type { Person } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { useListParams } from "@/lib/useListParams"

const GENDERS = ["FEMALE", "MALE", "NON_BINARY", "OTHER", "UNDISCLOSED"] as const

const EMPTY = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  national_id: "",
  national_id_country: "",
  birth_date: "",
  gender: "",
  personal_email: "",
  personal_phone: "",
  emergency_name: "",
  emergency_relation: "",
  emergency_phone: "",
}

export default function PeoplePage() {
  // Sorted by the Name column, so the default order matches a visible header.
  const params = useListParams({ ordering: "display_name", filters: { gender: [] } })

  const { data, error, isLoading, reload } = useApi<Paginated<Person>>(
    `/people/${params.queryString}`,
  )
  const crud = useCrud<Person>("/people", reload)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (crud.editing) {
      const p = crud.editing
      const contact = p.emergency_contact?.[0] ?? {}
      setForm({
        first_name: p.first_name,
        last_name: p.last_name,
        preferred_name: p.preferred_name,
        // national_id is never returned by the API (restricted PII), so the
        // field starts blank on edit; leaving it blank keeps the stored value.
        national_id: "",
        national_id_country: p.national_id_country,
        birth_date: p.birth_date ?? "",
        gender: p.gender ?? "",
        personal_email: p.personal_email,
        personal_phone: p.personal_phone,
        emergency_name: contact.name ?? "",
        emergency_relation: contact.relation ?? "",
        emergency_phone: contact.phone ?? "",
      })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  return (
    <>
      <PageHeader
        title="People"
        description="Every human on record. A person exists once, forever — a rehire is the same person with a new employment."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New person
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search people"
          placeholder="Search by name, email or phone…"
        />
        <FilterMenu
          label="Gender"
          allLabel="Any gender"
          values={params.filters.gender}
          onChange={(values) => params.setFilter("gender", values)}
          options={enumOptions(GENDERS)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState
            message="No one matches."
            hint="Add a person, then give them an employment."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="display_name" {...params.sort}>Name</SortableHead>
                  <SortableHead field="personal_email" {...params.sort}>
                    Personal email
                  </SortableHead>
                  <SortableHead field="personal_phone" {...params.sort}>Phone</SortableHead>
                  <TableHead>Emergency contact</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.display_name}</TableCell>
                    <TableCell>{person.personal_email || "—"}</TableCell>
                    <TableCell>{person.personal_phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.emergency_contact?.[0]?.name ?? (
                        <span className="text-destructive">Missing</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        actions={[
                          { label: "Edit", onSelect: () => crud.openEdit(person) },
                          {
                            label: "Delete",
                            destructive: true,
                            onSelect: () => crud.openDelete(person),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Pagination
        page={params.page}
        pageSize={params.pageSize}
        count={data?.count ?? 0}
        noun="person"
        plural="people"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="person"
        labelOf={(p) => p.display_name}
        buildBody={() => {
          const body: Record<string, unknown> = {
            first_name: form.first_name,
            last_name: form.last_name,
            preferred_name: form.preferred_name,
            national_id_country: form.national_id_country,
            birth_date: form.birth_date || null,
            gender: form.gender,
            personal_email: form.personal_email,
            personal_phone: form.personal_phone,
            emergency_contact: form.emergency_name
              ? [
                  {
                    name: form.emergency_name,
                    relation: form.emergency_relation,
                    phone: form.emergency_phone,
                  },
                ]
              : [],
          }
          // Only send the national ID when one was typed, so an edit that
          // leaves it blank does not wipe the stored value.
          if (form.national_id) body.national_id = form.national_id
          return body
        }}
      >
        {(errors) => (
          <>
            <FieldRow>
              <TextField
                name="first_name"
                label="First name"
                required
                errors={errors}
                value={form.first_name}
                onChange={(first_name) => setForm((f) => ({ ...f, first_name }))}
              />
              <TextField
                name="last_name"
                label="Last name"
                required
                errors={errors}
                value={form.last_name}
                onChange={(last_name) => setForm((f) => ({ ...f, last_name }))}
              />
            </FieldRow>
            <TextField
              name="preferred_name"
              label="Preferred name"
              hint="What the interface shows. Defaults to the first name."
              errors={errors}
              value={form.preferred_name}
              onChange={(preferred_name) => setForm((f) => ({ ...f, preferred_name }))}
            />
            <FieldRow>
              <TextField
                name="personal_email"
                label="Personal email"
                type="email"
                hint="Survives termination; used for offboarding."
                errors={errors}
                value={form.personal_email}
                onChange={(personal_email) => setForm((f) => ({ ...f, personal_email }))}
              />
              <TextField
                name="personal_phone"
                label="Personal phone"
                errors={errors}
                value={form.personal_phone}
                onChange={(personal_phone) => setForm((f) => ({ ...f, personal_phone }))}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="birth_date"
                label="Date of birth"
                type="date"
                errors={errors}
                value={form.birth_date}
                onChange={(birth_date) => setForm((f) => ({ ...f, birth_date }))}
              />
              <SelectField
                name="gender"
                label="Gender"
                allowEmpty
                hint="Self-declared, optional."
                errors={errors}
                value={form.gender}
                onChange={(gender) => setForm((f) => ({ ...f, gender }))}
                options={enumOptions(GENDERS)}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                name="national_id"
                label="National ID"
                hint={
                  crud.isEditing
                    ? "Leave blank to keep the stored value."
                    : "Stored but never shown again."
                }
                errors={errors}
                value={form.national_id}
                onChange={(national_id) => setForm((f) => ({ ...f, national_id }))}
              />
              <TextField
                name="national_id_country"
                label="ID country"
                hint="ISO 3166-1 alpha-2"
                errors={errors}
                value={form.national_id_country}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    national_id_country: v.toUpperCase().slice(0, 2),
                  }))
                }
              />
            </FieldRow>

            <fieldset className="grid gap-4 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">Emergency contact</legend>
              <TextField
                name="emergency_name"
                label="Name"
                errors={errors}
                value={form.emergency_name}
                onChange={(emergency_name) => setForm((f) => ({ ...f, emergency_name }))}
              />
              <FieldRow>
                <TextField
                  name="emergency_relation"
                  label="Relationship"
                  errors={errors}
                  value={form.emergency_relation}
                  onChange={(emergency_relation) =>
                    setForm((f) => ({ ...f, emergency_relation }))
                  }
                />
                <TextField
                  name="emergency_phone"
                  label="Phone"
                  errors={errors}
                  value={form.emergency_phone}
                  onChange={(emergency_phone) =>
                    setForm((f) => ({ ...f, emergency_phone }))
                  }
                />
              </FieldRow>
            </fieldset>
          </>
        )}
      </CrudDialogs>
    </>
  )
}
