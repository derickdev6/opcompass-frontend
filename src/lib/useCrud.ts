import { useCallback, useState } from "react"

import { api } from "@/lib/api"

type Dialog<T> =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; record: T }
  | { mode: "delete"; record: T }

/**
 * Dialog state and write calls for one collection.
 *
 * Each screen owns its own instance; there is no shared store. With one list
 * per screen that is enough, and it keeps the data flow obvious.
 */
export function useCrud<T extends { id: string }>(
  basePath: string,
  reload: () => void,
) {
  const [dialog, setDialog] = useState<Dialog<T>>({ mode: "closed" })

  const close = useCallback(() => setDialog({ mode: "closed" }), [])
  const openCreate = useCallback(() => setDialog({ mode: "create" }), [])
  const openEdit = useCallback((record: T) => setDialog({ mode: "edit", record }), [])
  const openDelete = useCallback(
    (record: T) => setDialog({ mode: "delete", record }),
    [],
  )

  const create = useCallback(
    (body: unknown) => api.post<T>(`${basePath}/`, body),
    [basePath],
  )
  const update = useCallback(
    (id: string, body: unknown) => api.patch<T>(`${basePath}/${id}/`, body),
    [basePath],
  )
  const remove = useCallback(
    (id: string) => api.delete(`${basePath}/${id}/`),
    [basePath],
  )

  /** Create or update depending on which dialog is open. */
  const save = useCallback(
    (body: unknown) =>
      dialog.mode === "edit" ? update(dialog.record.id, body) : create(body),
    [dialog, create, update],
  )

  return {
    dialog,
    isCreating: dialog.mode === "create",
    isEditing: dialog.mode === "edit",
    editing: dialog.mode === "edit" ? dialog.record : null,
    deleting: dialog.mode === "delete" ? dialog.record : null,
    openCreate,
    openEdit,
    openDelete,
    close,
    save,
    remove,
    reload,
  }
}
