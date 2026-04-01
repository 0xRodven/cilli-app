"use client"

import { useSupplierBreakdown } from "@/hooks/use-analytics"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { format, subMonths } from "date-fns"
import { Building2 } from "lucide-react"

interface TopSuppliersWidgetProps { className?: string }

export function TopSuppliersWidget({ className }: TopSuppliersWidgetProps) {
  const dateFrom = format(subMonths(new Date(), 1), "yyyy-MM-dd")
  const { data, loading } = useSupplierBreakdown(dateFrom)

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4" />
          Top fournisseurs
        </CardTitle>
        <CardDescription>Ce mois-ci</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>
        ) : (
          data.slice(0, 6).map((supplier, idx) => (
            <div key={supplier.name} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{supplier.name}</span>
                  <span className="text-sm tabular-nums shrink-0">{formatCurrency(supplier.value)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(supplier.pct, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">{supplier.pct.toFixed(0)}%</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
