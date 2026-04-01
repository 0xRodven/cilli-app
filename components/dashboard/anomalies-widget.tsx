"use client"

import Link from "next/link"
import { useAnomalies } from "@/hooks/use-anomalies"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, CheckCircle, XCircle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

const severityConfig = {
  high: { label: "Haute", variant: "destructive" as const, className: "border-l-red-500" },
  medium: { label: "Moyenne", variant: "warning" as const, className: "border-l-amber-500" },
  low: { label: "Faible", variant: "secondary" as const, className: "border-l-blue-400" },
}

const typeLabels: Record<string, string> = {
  price_increase: "Hausse de prix",
  price_decrease: "Baisse de prix",
  duplicate: "Doublon",
  missing_info: "Info manquante",
  supplier_too_expensive: "Fournisseur cher",
}

interface AnomaliesWidgetProps { className?: string }

export function AnomaliesWidget({ className }: AnomaliesWidgetProps) {
  const { anomalies, loading, resolveAnomaly, dismissAnomaly } = useAnomalies({ status: "new", limit: 5 })

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Alertes à traiter
          </CardTitle>
          <CardDescription>{anomalies.length} alerte{anomalies.length !== 1 ? "s" : ""} en attente</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/anomalies">
            Voir tout <ExternalLink className="size-3 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </>
        ) : anomalies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <CheckCircle className="size-8 mb-2 text-green-500" />
            <p className="text-sm">Aucune alerte active</p>
          </div>
        ) : (
          anomalies.map((anomaly) => {
            const sev = severityConfig[anomaly.severity] || severityConfig.low
            return (
              <div
                key={anomaly.id}
                className={cn("flex items-start gap-3 p-3 rounded-md border-l-2 bg-muted/30", sev.className)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{anomaly.supplierName || "Fournisseur inconnu"}</span>
                    <Badge variant={sev.variant} className="text-[10px]">{sev.label}</Badge>
                    <span className="text-xs text-muted-foreground">{typeLabels[anomaly.type] || anomaly.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{anomaly.description}</p>
                  {anomaly.percentageChange !== 0 && (
                    <p className="text-xs font-medium mt-0.5 text-amber-600">
                      {anomaly.percentageChange > 0 ? "+" : ""}{anomaly.percentageChange.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => resolveAnomaly(anomaly.id)}
                    title="Résoudre"
                  >
                    <CheckCircle className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => dismissAnomaly(anomaly.id)}
                    title="Écarter"
                  >
                    <XCircle className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
