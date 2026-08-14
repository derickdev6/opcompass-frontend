import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ApiError } from "@/lib/api"

interface ConfirmDeleteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What is being deleted, shown in the prompt. */
  label: string
  onConfirm: () => Promise<unknown>
  onSuccess?: () => void
}

/**
 * Delete confirmation.
 *
 * Deletes are soft on the server, but the server also refuses when other
 * records still depend on the row — that refusal comes back as a 400 and is
 * shown here rather than as a silent no-op.
 */
export default function ConfirmDelete({
  open,
  onOpenChange,
  label,
  onConfirm,
  onSuccess,
}: ConfirmDeleteProps) {
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirm() {
    setError(null)
    setIsDeleting(true)
    try {
      await onConfirm()
      onSuccess?.()
      onOpenChange(false)
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (caught.errors?.detail?.join(" ") ?? caught.message)
          : "Could not reach the server. Try again in a moment.",
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be removed from lists and reports. The record is retained for
            the audit trail rather than erased.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Keep the dialog open so a server refusal stays visible.
              event.preventDefault()
              void handleConfirm()
            }}
            disabled={isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
