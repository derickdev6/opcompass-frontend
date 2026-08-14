import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

interface ModuleSectionProps {
  /** The module this block belongs to, e.g. "People". */
  name: string
  /** One line on what the module covers. */
  description: string
  icon: LucideIcon
  /** Spec section the module maps to, e.g. "§5". Rendered as a quiet tag. */
  reference?: string
  actions?: ReactNode
  children: ReactNode
}

/**
 * One module's block on the dashboard.
 *
 * The dashboard is a stack of these, one per module. The heading and rule are
 * the visual division: at a glance you can tell which module a number belongs
 * to, which matters as soon as there is more than one. Adding a module means
 * adding another <ModuleSection>, not restructuring the page.
 */
export default function ModuleSection({
  name,
  description,
  icon: Icon,
  reference,
  actions,
  children,
}: ModuleSectionProps) {
  return (
    <section aria-labelledby={`module-${name.toLowerCase()}`} className="mb-10">
      <div className="mb-4 flex items-start gap-3 border-b pb-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/60">
          <Icon className="size-4.5 text-foreground/70" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              id={`module-${name.toLowerCase()}`}
              className="text-lg font-semibold tracking-tight"
            >
              {name}
            </h2>
            {reference && (
              <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {reference}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children}
    </section>
  )
}
