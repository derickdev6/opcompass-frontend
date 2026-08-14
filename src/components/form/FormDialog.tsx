import { useEffect, useState } from "react"
import type { FormEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError } from "@/lib/api"

export type FieldErrors = Record<string, string[]>

interface FormDialogProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  /** Called on submit. Throw to keep the dialog open and surface the error. */
  onSubmit: () => Promise<T>
  /** Called after a successful submit, before the dialog closes. */
  onSuccess?: (result: T) => void
  children: (errors: FieldErrors) => ReactNode
}

/**
 * A modal form with server-error handling.
 *
 * The whole point is the error path: DRF returns per-field messages under
 * `errors`, and this hands them to the fields so a message lands next to the
 * input that caused it instead of as one opaque banner.
 */
export default function FormDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Save",
  onSubmit,
  onSuccess,
  children,
}: FormDialogProps<T>) {
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Clear stale errors when the dialog is reopened, otherwise the previous
  // attempt's messages are still on screen.
  useEffect(() => {
    if (open) {
      setErrors({})
      setFormError(null)
    }
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    try {
      const result = await onSubmit()
      onSuccess?.(result)
      onOpenChange(false)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors ?? {})
        // `detail` on a validation error is generic; only show it as a banner
        // when there are no field-level messages to show instead.
        if (!caught.errors || Object.keys(caught.errors).length === 0) {
          setFormError(caught.message)
        } else if (caught.errors.detail) {
          setFormError(caught.errors.detail.join(" "))
        }
      } else {
        setFormError("Could not reach the server. Try again in a moment.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {formError && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}

          {children(errors)}

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
