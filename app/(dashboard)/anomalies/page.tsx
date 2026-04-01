"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnomalies } from "@/hooks/use-anomalies"
import { formatDate } from "@/lib/utils"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import type { Anomaly } from "@/lib/types"

const severityConfig = {
  high: { label: "Haute", variant: "destructive" as const, border: "border-l-red-500" },
  medium: { label: "Moyenne", variant: "warning" as const, border: "border-l-amber-500" },
  low: { label: "Faible", variant: "secondary" as const, border: "border-l-blue-400" },
}

const statusConfig = {
  new: { label: "Nouvelle", variant: "destructive" as const },
  reviewing: { label: "En cours", variant: "warning" as const },
  resolved: { label: "Résolue", variant: "success" as const },
  dismissed: { label: "Écartée", variant: "secondary" as const },
}

const typeLabels: Record<string, string> = {
  price_increase: "Hausse de prix",
  price_decrease: "Baisse de prix",
  duplicate: "Doublon",
  missing_info: "Information manquante",
  supplier_too_expensive: "Fournisseur trop cher",
}

export default function AnomaliesPage() {
  const [statusFilter, setStatusFilter] = useState("new")
  const [severityFilter, setSeverityFilter] = useState("")

  const { anomalies, loading, resolveAnomaly, dismissAnomaly } = useAnomalies({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Alertes"
        description={`${anomalies.length} alerte${anomalies.length !== 1 ? "s" : ""}`}
        sticky
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
        </div>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="new">Nouvelles</SelectItem>
                <SelectItem value="reviewing">En cours</SelectItem>
                <SelectItem value="resolved">Résolues</SelectItem>
                <SelectItem value="dismissed">Écartées</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Toutes sévérités" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sévérités</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : anomalies.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <CheckCircle className="size-10 mb-3 text-green-500" />
              <p className="font-medium">Aucune alerte</p>
              <p className="text-sm mt-1">
                {statusFilter === "new" ? "Aucune nouvelle alerte — tout va bien !" : "Aucune alerte pour ce filtre"}
              </p>
            </CardContent>
          </Card>
        ) : (
          anomalies.map((anomaly: Anomaly) => {
            const sev = severityConfig[anomaly.severity] || severityConfig.low
            const st = statusConfig[anomaly.status] || statusConfig.new
            return (
              <Card key={anomaly.id} className={`border-l-4 ${sev.border} gap-3 py-3`}>
                <CardContent className="px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{anomaly.supplierName || "Fournisseur inconnu"}</span>
                        <Badge variant={sev.variant}>{sev.label}</Badge>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        <span className="text-sm text-muted-foreground">{typeLabels[anomaly.type] || anomaly.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{anomaly.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {anomaly.percentageChange !== 0 && (
                          <span className={anomaly.percentageChange > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                            {anomaly.percentageChange > 0 ? "+" : ""}{anomaly.percentageChange.toFixed(1)}%
                          </span>
                        )}
                        <span>{formatDate(anomaly.created)}</span>
                      </div>
                    </div>
                    {anomaly.status === "new" || anomaly.status === "reviewing" ? (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                          onClick={() => resolveAnomaly(anomaly.id)}
                        >
                          <CheckCircle className="size-4 mr-1" />
                          Résoudre
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => dismissAnomaly(anomaly.id)}
                        >
                          <XCircle className="size-4 mr-1" />
                          Écarter
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
