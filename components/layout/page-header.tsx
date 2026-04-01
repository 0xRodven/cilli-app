import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  filterSlot?: React.ReactNode
  className?: string
  sticky?: boolean
}

export function PageHeader({ title, description, children, filterSlot, className, sticky }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        sticky && "sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 pt-2",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
      {filterSlot && <div>{filterSlot}</div>}
    </div>
  )
}
