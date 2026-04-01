"use client"

import { Euro, FileText, AlertTriangle, Clock, TrendingUp, TrendingDown, Target } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useWeekStats } from "@/hooks/use-analytics"
import { useAnomalies } from "@/hooks/use-anomalies"
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils"
import { cn } from "@/lib/utils"

const today = new Date().toISOString().split("T")[0]

export default function WeekPage() {
  const { data, loading, error } = useWeekStats()
  const { anomalies, loading: anomaliesLoading, resolveAnomaly, dismissAnomaly } = useAnomalies({ status: "new", limit: 10 })

  const weekDelta = data
    ? data.prevWeekTotal > 0 ? ((data.weekTotal - data.prevWeekTotal) / data.prevWeekTotal) * 100 : 0
    : 0
  const prevMonthDelta = data
    ? data.prevMonthWeekTotal > 0 ? ((data.weekTotal - data.prevMonthWeekTotal) / data.prevMonthWeekTotal) * 100 : 0
    : 0
  const isUp = weekDelta > 0

  // Weekly purchasing target = (monthly avg revenue × 30%) / 4.33
  const weeklyTarget = data ? (data.monthlyAvgRevenue * 0.30) / 4.33 : 0
  const progressPct = weeklyTarget > 0 ? Math.min((data?.weekTotal ?? 0) / weeklyTarget * 100, 100) : 0
  const isOverBudget = data && weeklyTarget > 0 && data.weekTotal > weeklyTarget

  const top5 = data?.thisWeekInvoices.slice(0, 5) ?? []

  return (
    <div className="space-y-4 max-w-lg mx-auto lg:max-w-none">
      <PageHeader title="Ma semaine" description="Vue rapide pour cette semaine" />

      {/* Big number */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-1">Dépenses cette semaine</p>
              <p className="text-4xl font-bold tabular-nums">{formatCurrency(data?.weekTotal || 0)}</p>
              <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
                <div className={cn("flex items-center gap-1 text-sm", isUp ? "text-red-600" : "text-green-600")}>
                  {isUp ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  <span>{isUp ? "+" : ""}{weekDelta.toFixed(1)}% vs semaine préc.</span>
                </div>
                {data && data.prevMonthWeekTotal > 0 && (
                  <div className={cn("flex items-center gap-1 text-sm text-muted-foreground")}>
                    <span className="text-xs">
                      {prevMonthDelta > 0 ? "+" : ""}{prevMonthDelta.toFixed(1)}% vs même semaine mois préc.
                    </span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-xs mt-1">
                Semaine précédente : {formatCurrency(data?.prevWeekTotal || 0)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly target progress */}
      {!loading && weeklyTarget > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Objectif hebdomadaire</span>
              </div>
              <span className="text-sm font-semibold">
                {formatCurrency(data?.weekTotal || 0)} / {formatCurrency(weeklyTarget)}
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isOverBudget ? "bg-red-500" : progressPct > 80 ? "bg-amber-500" : "bg-green-500"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isOverBudget
                ? `Budget dépassé de ${formatCurrency((data?.weekTotal || 0) - weeklyTarget)}`
                : `${formatPercent(progressPct)} du budget achats (30% CA moyen / semaine)`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <FileText className="size-5 mx-auto mb-1 text-muted-foreground" />
            {loading ? <Skeleton className="h-8 mx-auto w-12" /> : (
              <p className="text-2xl font-bold">{data?.invoiceCount || 0}</p>
            )}
            <p className="text-xs text-muted-foreground">Factures reçues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="size-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{anomalies.length}</p>
            <p className="text-xs text-muted-foreground">Alertes actives</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 invoices this week */}
      {!loading && top5.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Euro className="size-4" />
              Top factures cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {top5.map((inv, i) => {
              const isOverdue = inv.dueDate && inv.dueDate < today && inv.status !== "paid"
              return (
                <div key={inv.id ?? i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {inv.supplierName || "—"}
                      {isOverdue && (
                        <span className="ml-1.5 text-[10px] font-medium text-red-600">(en retard)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.invoiceDate)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0 text-right">
                    {formatCurrency(inv.totalHT || 0)}
                  </span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Upcoming due dates */}
      {!loading && data && data.upcomingDue.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="size-4" />
              Prochaines échéances (7 jours)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingDue.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{inv.supplierName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(inv.dueDate)}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(inv.totalTTC)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Anomalies urgentes */}
      {!anomaliesLoading && anomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Alertes à traiter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {anomalies.slice(0, 5).map((anomaly) => (
              <div key={anomaly.id} className="flex items-start gap-2 p-2 bg-muted/40 rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium truncate">{anomaly.supplierName}</span>
                    <Badge
                      variant={anomaly.severity === "high" ? "destructive" : anomaly.severity === "medium" ? "warning" : "secondary"}
                      className="text-[10px]"
                    >
                      {anomaly.severity === "high" ? "Haute" : anomaly.severity === "medium" ? "Moyenne" : "Faible"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{anomaly.description}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => resolveAnomaly(anomaly.id)}
                    className="text-xs text-green-600 hover:underline px-1"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => dismissAnomaly(anomaly.id)}
                    className="text-xs text-muted-foreground hover:underline px-1"
                  >
                    ✗
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
