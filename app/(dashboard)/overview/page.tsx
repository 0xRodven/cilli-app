"use client"

import { useRouter } from "next/navigation"
import { Euro, ShoppingCart, TrendingUp, FileText, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { KPICard } from "@/components/dashboard/kpi-card"
import { RevenueMarginChart } from "@/components/dashboard/revenue-margin-chart"
import { SupplierParetoChart } from "@/components/dashboard/supplier-pareto-chart"
import { AnomaliesWidget } from "@/components/dashboard/anomalies-widget"
import { ActivityTimeline } from "@/components/dashboard/activity-timeline"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { useDashboardKPIs } from "@/hooks/use-analytics"
import { useDateFilter } from "@/contexts/date-filter-context"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrencyCompact, formatPercent } from "@/lib/utils"

const PRESET_LABELS: Record<string, string> = {
  this_week: "cette semaine",
  this_month: "ce mois",
  last_month: "le mois dernier",
  "3_months": "les 3 derniers mois",
  "6_months": "les 6 derniers mois",
  this_year: "cette année",
  custom: "la période sélectionnée",
}

export default function OverviewPage() {
  const router = useRouter()
  const { dateFrom, dateTo, comparisonDateFrom, comparisonDateTo, comparisonMode, preset } = useDateFilter()
  const { kpis, loading, error } = useDashboardKPIs({
    dateFrom,
    dateTo,
    comparisonDateFrom: comparisonMode !== "none" ? comparisonDateFrom : "",
    comparisonDateTo: comparisonMode !== "none" ? comparisonDateTo : "",
  })

  const periodLabel = PRESET_LABELS[preset] || "la période"
  const comparisonLabel = comparisonMode === "same_period_last_year" ? "vs N-1" : "vs période préc."

  // Margin color
  const marginColor =
    kpis?.grossMarginPct === null ? "blue"
    : (kpis?.grossMarginPct ?? 0) >= 30 ? "green"
    : (kpis?.grossMarginPct ?? 0) >= 25 ? "amber"
    : "red"

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Vue d'ensemble"
        description={`Données pour ${periodLabel}`}
        sticky
        filterSlot={<DateRangeFilter />}
      />

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Erreur de chargement : {error}</span>
        </div>
      )}

      {/* Anomaly banner */}
      {!loading && kpis && kpis.activeAnomalies > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            <span className="font-semibold">{kpis.activeAnomalies} anomalie{kpis.activeAnomalies > 1 ? "s" : ""}</span>
            {" "}active{kpis.activeAnomalies > 1 ? "s" : ""} — vérifiez la section Alertes
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <KPICard
              title="Chiffre d'affaires"
              subtitle={periodLabel}
              value={kpis ? formatCurrencyCompact(kpis.caThisMonth) : "—"}
              icon={Euro}
              color="green"
              trend={kpis?.caTrend !== null && kpis?.caTrend !== undefined
                ? { value: kpis.caTrend, label: comparisonLabel }
                : undefined}
            />
            <KPICard
              title="Achats"
              subtitle={periodLabel}
              value={kpis ? formatCurrencyCompact(kpis.purchasesThisMonth) : "—"}
              icon={ShoppingCart}
              color="blue"
              trendInverted
              trend={kpis?.purchasesTrend !== null && kpis?.purchasesTrend !== undefined
                ? { value: kpis.purchasesTrend, label: comparisonLabel }
                : undefined}
            />
            <KPICard
              title="Marge brute"
              subtitle="Estimation (CA − Achats)"
              value={kpis ? formatCurrencyCompact(kpis.grossMargin) : "—"}
              secondaryValue={kpis?.grossMarginPct !== null && kpis?.grossMarginPct !== undefined
                ? `(${formatPercent(kpis.grossMarginPct)})`
                : kpis ? "N/A — données indisponibles" : undefined}
              icon={TrendingUp}
              color={marginColor}
              trend={kpis?.grossMarginTrend !== null && kpis?.grossMarginTrend !== undefined
                ? { value: kpis.grossMarginTrend, label: "pts " + comparisonLabel }
                : undefined}
            />
            <KPICard
              title="Factures en attente"
              value={kpis ? kpis.pendingInvoices.toString() : "—"}
              secondaryValue={kpis && kpis.pendingInvoicesAmount > 0
                ? formatCurrencyCompact(kpis.pendingInvoicesAmount)
                : undefined}
              icon={FileText}
              color="amber"
              onClick={() => router.push("/invoices?status=pending")}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-5">
        <RevenueMarginChart className="lg:col-span-3" />
        <SupplierParetoChart className="lg:col-span-2" />
      </div>

      {/* Widgets row */}
      <div className="grid gap-6 lg:grid-cols-5">
        <AnomaliesWidget className="lg:col-span-3" />
        <ActivityTimeline className="lg:col-span-2" />
      </div>
    </div>
  )
}
