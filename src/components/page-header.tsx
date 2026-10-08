import { cn } from "@/lib/utils"

/** Title row shared by every studio page. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-stroke-strong px-4 py-6 sm:px-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-xs font-medium text-brand">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Centered empty/blocked state with one clear next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center", className)}>
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
