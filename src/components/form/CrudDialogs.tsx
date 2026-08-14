import type { ReactNode } from "react"

import ConfirmDelete from "@/components/form/ConfirmDelete"
import FormDialog from "@/components/form/FormDialog"
import type { FieldErrors } from "@/components/form/FormDialog"

interface CrudDialogsProps<T extends { id: string }> {
  crud: {
    isCreating: boolean
    isEditing: boolean
    editing: T | null
    deleting: T | null
    close: () => void
    save: (body: unknown) => Promise<unknown>
    remove: (id: string) => Promise<unknown>
    reload: () => void
  }
  /** Singular noun, e.g. "location". Used in every title and prompt. */
  noun: string
  /** How to describe the record being deleted. */
  labelOf: (record: T) => string
  /** Body to send. Called on submit so it reads the latest field state. */
  buildBody: () => unknown
  children: (errors: FieldErrors) => ReactNode
  description?: string
}

/**
 * The create, edit and delete dialogs for one collection.
 *
 * Create and edit share one form: the fields are identical, only the title and
 * the request method differ. Keeping them together means a new field cannot be
 * added to one and forgotten in the other.
 */
export default function CrudDialogs<T extends { id: string }>({
  crud,
  noun,
  labelOf,
  buildBody,
  children,
  description,
}: CrudDialogsProps<T>) {
  const isOpen = crud.isCreating || crud.isEditing

  return (
    <>
      <FormDialog
        open={isOpen}
        onOpenChange={(open) => !open && crud.close()}
        title={crud.isEditing ? `Edit ${noun}` : `New ${noun}`}
        description={description}
        onSubmit={() => crud.save(buildBody())}
        onSuccess={crud.reload}
      >
        {children}
      </FormDialog>

      <ConfirmDelete
        open={crud.deleting !== null}
        onOpenChange={(open) => !open && crud.close()}
        label={crud.deleting ? `${noun} “${labelOf(crud.deleting)}”` : noun}
        onConfirm={() => crud.remove(crud.deleting!.id)}
        onSuccess={crud.reload}
      />
    </>
  )
}
