import { Check, Plus, X } from "lucide-react"
import { useEffect, useState } from "react"

import { EmptyState, ErrorState, LoadingRows } from "@/components/DataState"
import CrudDialogs from "@/components/form/CrudDialogs"
import {
  CheckboxField,
  FieldRow,
  SelectField,
  TextField,
  enumOptions,
} from "@/components/form/Field"
import FormDialog from "@/components/form/FormDialog"
import RowActions from "@/components/form/RowActions"
import FilterSelect from "@/components/list/FilterSelect"
import ListToolbar from "@/components/list/ListToolbar"
import Pagination from "@/components/list/Pagination"
import SearchInput from "@/components/list/SearchInput"
import SortableHead from "@/components/list/SortableHead"
import PageHeader from "@/components/PageHeader"
import { Badge } from "@/components/ui/badge"
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
import { api, query } from "@/lib/api"
import type { Paginated } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { Person, UserAccount } from "@/lib/types"
import { useApi } from "@/lib/useApi"
import { useCrud } from "@/lib/useCrud"
import { ALL, useListParams } from "@/lib/useListParams"

const STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "DISABLED"] as const
const PROVIDERS = ["LOCAL", "OIDC", "SAML"] as const

const EMPTY = {
  email: "",
  password: "",
  person: "",
  status: "ACTIVE",
  auth_provider: "LOCAL",
  is_staff: false,
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()

  const params = useListParams({
    ordering: "email",
    filters: { status: ALL, auth_provider: ALL },
  })
  const { data, error, isLoading, reload } = useApi<Paginated<UserAccount>>(
    `/users/${params.queryString}`,
  )
  const people = useApi<Paginated<Person>>(`/people/${query({ page_size: 200 })}`)

  const crud = useCrud<UserAccount>("/users", reload)
  const [form, setForm] = useState(EMPTY)

  const [statusTarget, setStatusTarget] = useState<UserAccount | null>(null)
  const [statusForm, setStatusForm] = useState({ status: "ACTIVE", reason: "" })

  useEffect(() => {
    if (crud.editing) {
      const u = crud.editing
      setForm({
        email: u.email,
        password: "",
        person: u.person ?? "",
        status: u.status,
        auth_provider: u.auth_provider,
        is_staff: u.is_staff,
      })
    } else if (crud.isCreating) {
      setForm(EMPTY)
    }
  }, [crud.editing, crud.isCreating])

  useEffect(() => {
    if (statusTarget) {
      setStatusForm({ status: statusTarget.status, reason: "" })
    }
  }, [statusTarget])

  return (
    <>
      <PageHeader
        title="Users"
        description="Sign-in accounts. A user is an identity, not a person — service accounts have no person attached."
        actions={
          <Button onClick={crud.openCreate}>
            <Plus className="size-4" aria-hidden />
            New user
          </Button>
        }
      />

      <ListToolbar>
        <SearchInput
          value={params.search}
          onChange={params.setSearch}
          label="Search users"
          placeholder="Search by email or person…"
        />
        <FilterSelect
          label="Status"
          allLabel="All statuses"
          value={params.filters.status}
          onChange={(value) => params.setFilter("status", value)}
          options={enumOptions(STATUSES)}
        />
        <FilterSelect
          label="Provider"
          allLabel="All providers"
          value={params.filters.auth_provider}
          onChange={(value) => params.setFilter("auth_provider", value)}
          options={enumOptions(PROVIDERS)}
        />
      </ListToolbar>

      <Card className="overflow-hidden py-0">
        {isLoading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState message={error} />
        ) : !data || data.results.length === 0 ? (
          <EmptyState message="No users match." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead field="email" {...params.sort}>Email</SortableHead>
                  <SortableHead field="person_name" {...params.sort}>Person</SortableHead>
                  <SortableHead field="status" {...params.sort}>Status</SortableHead>
                  <SortableHead field="can_sign_in" {...params.sort}>
                    Can sign in
                  </SortableHead>
                  <SortableHead field="auth_provider" {...params.sort}>
                    Provider
                  </SortableHead>
                  <SortableHead field="last_login_at" {...params.sort}>
                    Last login
                  </SortableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((account) => {
                  const isSelf = account.id === currentUser?.id
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">
                        {account.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {account.person_name ?? (
                          <span className="text-muted-foreground">Service account</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal capitalize">
                          {account.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.can_sign_in ? (
                          <Check
                            className="size-4 text-emerald-600"
                            aria-label="Yes"
                          />
                        ) : (
                          <X className="size-4 text-muted-foreground" aria-label="No" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.auth_provider}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {account.last_login_at
                          ? new Date(account.last_login_at).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <RowActions
                          actions={[
                            { label: "Edit", onSelect: () => crud.openEdit(account) },
                            // Both guarded server-side too; hiding them here
                            // just avoids offering an action that will fail.
                            ...(isSelf
                              ? []
                              : [
                                  {
                                    label: "Change status",
                                    onSelect: () => setStatusTarget(account),
                                  },
                                  {
                                    label: "Delete",
                                    destructive: true,
                                    onSelect: () => crud.openDelete(account),
                                  },
                                ]),
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Pagination
        page={params.page}
        pageSize={params.pageSize}
        count={data?.count ?? 0}
        noun="user"
        onPageChange={params.setPage}
        onPageSizeChange={params.setPageSize}
      />

      <CrudDialogs
        crud={crud}
        noun="user"
        labelOf={(u) => u.email}
        description="Only an Active account can sign in."
        buildBody={() => {
          const body: Record<string, unknown> = {
            email: form.email,
            person: form.person || null,
            status: form.status,
            auth_provider: form.auth_provider,
            is_staff: form.is_staff,
          }
          // Omitted on edit unless deliberately changed, so saving an unrelated
          // field does not reset someone's password.
          if (form.password) body.password = form.password
          return body
        }}
      >
        {(errors) => (
          <>
            <TextField
              name="email"
              label="Email"
              type="email"
              required
              hint="This is the login identifier."
              errors={errors}
              value={form.email}
              onChange={(email) => setForm((f) => ({ ...f, email }))}
            />
            <TextField
              name="password"
              label={crud.isEditing ? "New password" : "Password"}
              type="password"
              required={!crud.isEditing}
              autoComplete="new-password"
              hint={
                crud.isEditing
                  ? "Leave blank to keep the current password."
                  : "Checked against the configured password rules."
              }
              errors={errors}
              value={form.password}
              onChange={(password) => setForm((f) => ({ ...f, password }))}
            />
            <SelectField
              name="person"
              label="Person"
              allowEmpty
              hint="Leave empty for a service account or integration."
              errors={errors}
              value={form.person}
              onChange={(person) => setForm((f) => ({ ...f, person }))}
              options={(people.data?.results ?? []).map((p) => ({
                value: p.id,
                label: p.display_name,
              }))}
            />
            <FieldRow>
              <SelectField
                name="status"
                label="Status"
                errors={errors}
                value={form.status}
                onChange={(status) => setForm((f) => ({ ...f, status }))}
                options={enumOptions(STATUSES)}
              />
              <SelectField
                name="auth_provider"
                label="Auth provider"
                errors={errors}
                value={form.auth_provider}
                onChange={(auth_provider) => setForm((f) => ({ ...f, auth_provider }))}
                options={enumOptions(PROVIDERS)}
              />
            </FieldRow>
            <CheckboxField
              name="is_staff"
              label="Can access the Django admin"
              errors={errors}
              checked={form.is_staff}
              onChange={(is_staff) => setForm((f) => ({ ...f, is_staff }))}
            />
          </>
        )}
      </CrudDialogs>

      <FormDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={`Change status — ${statusTarget?.email ?? ""}`}
        description="Only an Active account can sign in. Suspending takes effect on their next token refresh."
        submitLabel="Change status"
        onSubmit={() =>
          api.post(`/users/${statusTarget!.id}/set-status/`, statusForm)
        }
        onSuccess={reload}
      >
        {(errors) => (
          <>
            <SelectField
              name="status"
              label="Status"
              required
              errors={errors}
              value={statusForm.status}
              onChange={(status) => setStatusForm((f) => ({ ...f, status }))}
              options={enumOptions(STATUSES)}
            />
            <TextField
              name="reason"
              label="Reason"
              hint="Recorded on the audit event."
              errors={errors}
              value={statusForm.reason}
              onChange={(reason) => setStatusForm((f) => ({ ...f, reason }))}
            />
          </>
        )}
      </FormDialog>
    </>
  )
}
